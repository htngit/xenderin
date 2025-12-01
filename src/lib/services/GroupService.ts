import { ContactGroup } from './types';
import { supabase, handleDatabaseError } from '../supabase';
import { db, LocalGroup } from '../db';
import { SyncManager } from '../sync/SyncManager';
import { userContextManager } from '../security/UserContextManager';
import {
  toISOString,
  localToSupabase,
  addSyncMetadata,
  addTimestamps,
  standardizeForService
} from '../utils/timestamp';
import type { RealtimeChannel } from '@supabase/supabase-js';

export class GroupService {
  private realtimeChannel: RealtimeChannel | null = null;
  private syncManager: SyncManager;
  private masterUserId: string | null = null;

  constructor(syncManager?: SyncManager) {
    this.syncManager = syncManager || new SyncManager();
    this.setupSyncEventListeners();
  }

  /**
   * Setup event listeners for sync events
   */
  private setupSyncEventListeners() {
    this.syncManager.addEventListener((event) => {
      if (event.table === 'groups') {
        switch (event.type) {
          case 'sync_complete':
            console.log('Group sync completed');
            break;
          case 'sync_error':
            console.error('Group sync error:', event.error);
            break;
          case 'conflict_detected':
            console.warn('Group conflict detected:', event.message);
            break;
        }
      }
    });
  }

  /**
   * Get current user or throw error
   */
  private async getCurrentUser() {
    const user = await userContextManager.getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    return user;
  }

  /**
   * Set the current master user ID and configure sync
   */
  async initialize(masterUserId: string) {
    this.masterUserId = masterUserId;
    this.syncManager.setMasterUserId(masterUserId);

    // Start auto sync
    this.syncManager.startAutoSync();

    // Initial sync with error handling
    // Initial sync with error handling (non-blocking)
    this.syncManager.triggerSync().catch(error => {
      console.warn('Initial sync failed, will retry later:', error);
    });
  }


  /**
   * Background sync groups without blocking the main operation
   */
  private async backgroundSyncGroups(): Promise<void> {
    try {
      // Don't await this to avoid blocking the main operation
      this.syncManager.triggerSync().catch(error => {
        console.warn('Background sync failed:', error);
      });
    } catch (error) {
      console.warn('Failed to trigger background sync:', error);
    }
  }

  private async getMasterUserId(): Promise<string> {
    if (this.masterUserId) {
      return this.masterUserId;
    }

    const user = await this.getCurrentUser();

    // Get user's profile to find master_user_id
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('master_user_id')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      return user.id; // Fallback to current user ID
    }

    this.masterUserId = profile?.master_user_id || user.id;
    return this.masterUserId!;
  }

  /**
   * Get all groups for the current user's master account
   * Prioritizes local data, falls back to server if needed
   * Enforces data isolation using UserContextManager
   * Enhanced with offline-first approach and better error handling
   */
  async getGroups(): Promise<ContactGroup[]> {
    try {
      // RLS policies handle data isolation at the database level
      const masterUserId = await this.getMasterUserId();

      // Check online status and prioritize accordingly
      const isOnline = this.syncManager.getIsOnline();

      // First, try to get from local database
      let localGroups = await db.groups
        .where('master_user_id')
        .equals(masterUserId)
        .and(group => !group._deleted && group.is_active !== false)
        .toArray();

      // If we have local data, return it immediately (offline-first approach)
      if (localGroups.length > 0) {
        const transformedGroups = this.transformLocalGroups(localGroups);

        // If online, trigger background sync to update local data
        if (isOnline) {
          this.backgroundSyncGroups().catch(console.warn);
        }

        return transformedGroups;
      }

      // No local data available
      if (isOnline) {
        try {
          // Try to sync from server
          await this.syncManager.triggerSync();

          // Try local again after sync
          localGroups = await db.groups
            .where('master_user_id')
            .equals(masterUserId)
            .and(group => !group._deleted && group.is_active !== false)
            .toArray();

          if (localGroups.length > 0) {
            return this.transformLocalGroups(localGroups);
          }
        } catch (syncError) {
          console.warn('Sync failed, trying direct server fetch:', syncError);
        }

        // Fallback to direct server fetch
        return await this.fetchGroupsFromServer();
      } else {
        // Offline mode: return empty array or cached data
        console.log('Operating in offline mode - no groups available locally');
        return [];
      }
    } catch (error) {
      console.error('Error fetching groups:', error);

      // Enhanced error handling with offline fallback
      const isOnline = this.syncManager.getIsOnline();
      if (!isOnline) {
        // In offline mode, try to return whatever local data we have
        try {
          const masterUserId = await this.getMasterUserId();
          const localGroups = await db.groups
            .where('master_user_id')
            .equals(masterUserId)
            .and(group => !group._deleted && group.is_active !== false)
            .toArray();

          if (localGroups.length > 0) {
            return this.transformLocalGroups(localGroups);
          }
        } catch (offlineError) {
          console.error('Even offline fallback failed:', offlineError);
        }

        return [];
      }

      // Online mode fallback to server
      try {
        return await this.fetchGroupsFromServer();
      } catch (serverError) {
        console.error('Server fetch also failed:', serverError);
        throw new Error(`Failed to fetch groups: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Transform local groups to match interface using standardized timestamps
   */
  private transformLocalGroups(localGroups: LocalGroup[]): ContactGroup[] {
    return localGroups.map(group => {
      // Use standardized timestamp transformation
      const standardized = standardizeForService(group, 'group');
      return {
        ...standardized,
        id: group.id,
        name: group.name,
        description: group.description || undefined,
        color: group.color || '#3b82f6',
        master_user_id: group.master_user_id || undefined,
        created_by: group.created_by || undefined,
        contact_count: group.contact_count || 0,
        is_active: group.is_active !== false
      };
    });
  }

  /**
   * Fetch groups directly from server
   */
  private async fetchGroupsFromServer(): Promise<ContactGroup[]> {
    const masterUserId = await this.getMasterUserId();

    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .eq('master_user_id', masterUserId)
      .eq('is_active', true)
      .order('name');

    if (error) throw error;

    // Transform server data with standardized timestamps
    return (data || []).map(group => {
      const standardized = standardizeForService(group, 'group');
      return {
        ...standardized,
        contact_count: group.contact_count || 0
      };
    });
  }

  /**
   * Get a single group by ID
   */
  async getGroupById(id: string): Promise<ContactGroup | null> {
    try {
      const masterUserId = await this.getMasterUserId();

      // Try local first
      const localGroup = await db.groups.get(id);

      if (localGroup && !localGroup._deleted && localGroup.is_active !== false && localGroup.master_user_id === masterUserId) {
        const transformed = this.transformLocalGroups([localGroup]);
        return transformed[0] || null;
      }

      // Fallback to server
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('id', id)
        .eq('master_user_id', masterUserId)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // No rows returned
        throw error;
      }

      // Transform with standardized timestamps
      const standardized = standardizeForService(data, 'group');
      return {
        ...standardized,
        contact_count: data.contact_count || 0
      };
    } catch (error) {
      console.error('Error fetching group by ID:', error);
      throw new Error(handleDatabaseError(error));
    }
  }

  /**
   * Create a new group - local first with sync
   */
  async createGroup(groupData: Omit<ContactGroup, 'id' | 'created_at' | 'updated_at' | 'contact_count' | 'master_user_id' | 'created_by'>): Promise<ContactGroup> {
    try {
      const user = await this.getCurrentUser();
      const masterUserId = await this.getMasterUserId();

      // Check if group name is already taken
      if (await this.isGroupNameTaken(groupData.name)) {
        throw new Error('Group name is already taken');
      }

      // Use standardized timestamp utilities
      const timestamps = addTimestamps({}, false);
      const syncMetadata = addSyncMetadata({}, false);

      // Prepare local group data with required timestamps
      const newLocalGroup: Omit<LocalGroup, 'id'> = {
        name: groupData.name,
        description: groupData.description || undefined,
        color: groupData.color || '#3b82f6',
        master_user_id: masterUserId,
        created_by: user.id,
        contact_count: 0,
        is_active: true,
        created_at: timestamps.created_at,
        updated_at: timestamps.updated_at,
        _syncStatus: syncMetadata._syncStatus,
        _lastModified: syncMetadata._lastModified,
        _version: syncMetadata._version,
        _deleted: false
      };

      // Add to local database first
      const groupId = crypto.randomUUID();
      const localGroup = {
        id: groupId,
        ...newLocalGroup
      };

      await db.groups.add(localGroup);

      // Transform for sync queue (convert Date objects to ISO strings)
      const syncData = localToSupabase(localGroup);
      await this.syncManager.addToSyncQueue('groups', 'create', groupId, syncData);

      // Return transformed group
      return this.transformLocalGroups([localGroup])[0];
    } catch (error) {
      console.error('Error creating group:', error);
      throw new Error(handleDatabaseError(error));
    }
  }

  /**
   * Update an existing group - local first with sync
   */
  async updateGroup(id: string, groupData: Partial<Omit<ContactGroup, 'id' | 'created_at' | 'contact_count' | 'master_user_id' | 'created_by'>>): Promise<ContactGroup | null> {
    try {
      await this.getMasterUserId();

      // Check if group exists locally
      const existingGroup = await db.groups.get(id);

      if (!existingGroup || existingGroup._deleted) {
        // Group doesn't exist locally, try server
        const serverGroup = await this.getGroupById(id);
        if (!serverGroup) {
          throw new Error('Group not found');
        }
      }

      // Check if name is being changed and if it's available
      if (groupData.name && groupData.name !== existingGroup?.name) {
        if (await this.isGroupNameTaken(groupData.name, id)) {
          throw new Error('Group name is already taken');
        }
      }

      // Use standardized timestamp utilities for updates
      const timestamps = addTimestamps({}, true);
      const syncMetadata = addSyncMetadata(existingGroup, true);

      // Prepare update data
      const updateData = {
        ...groupData,
        updated_at: timestamps.updated_at,
        _syncStatus: syncMetadata._syncStatus,
        _lastModified: syncMetadata._lastModified,
        _version: syncMetadata._version
      };

      // Update local database
      await db.groups.update(id, updateData);

      // Get updated record for sync
      const updatedGroup = await db.groups.get(id);
      if (updatedGroup) {
        // Transform for sync queue (convert Date objects to ISO strings)
        const syncData = localToSupabase(updatedGroup);
        await this.syncManager.addToSyncQueue('groups', 'update', id, syncData);

        // Return transformed group
        return this.transformLocalGroups([updatedGroup])[0];
      }

      return null;
    } catch (error) {
      console.error('Error updating group:', error);
      throw new Error(handleDatabaseError(error));
    }
  }

  /**
   * Delete a group (soft delete by setting is_active to false) - local first with sync
   */
  async deleteGroup(id: string): Promise<boolean> {
    try {
      await this.getMasterUserId();

      // Check if group exists locally
      const existingGroup = await db.groups.get(id);

      if (!existingGroup || existingGroup._deleted) {
        // Group doesn't exist locally, try server-side delete
        await this.deleteGroupFromServer(id);
        return true;
      }

      // Use standardized sync metadata for soft delete
      const syncMetadata = addSyncMetadata(existingGroup, true);

      // Soft delete locally
      await db.groups.update(id, {
        is_active: false,
        updated_at: syncMetadata._lastModified, // Use the same timestamp for consistency
        _syncStatus: syncMetadata._syncStatus,
        _lastModified: syncMetadata._lastModified,
        _version: syncMetadata._version,
        _deleted: true
      });

      // Transform for sync queue (convert Date objects to ISO strings)
      const syncData = localToSupabase(existingGroup);
      await this.syncManager.addToSyncQueue('groups', 'delete', id, syncData);

      return true;
    } catch (error) {
      console.error('Error deleting group:', error);
      throw new Error(handleDatabaseError(error));
    }
  }

  /**
   * Delete group from server (fallback)
   */
  private async deleteGroupFromServer(id: string): Promise<void> {
    const masterUserId = await this.getMasterUserId();

    const { error } = await supabase
      .from('groups')
      .update({
        is_active: false,
        updated_at: toISOString(new Date())
      })
      .eq('id', id)
      .eq('master_user_id', masterUserId);

    if (error) throw error;
  }

  /**
   * Permanently delete a group (use with caution) - local first with sync
   */
  async permanentlyDeleteGroup(id: string): Promise<boolean> {
    try {
      const masterUserId = await this.getMasterUserId();

      // Check if group exists locally
      const existingGroup = await db.groups.get(id);

      if (existingGroup) {
        // Hard delete locally
        await db.groups.delete(id);

        // Transform for sync queue (convert Date objects to ISO strings)
        const syncData = localToSupabase(existingGroup);
        await this.syncManager.addToSyncQueue('groups', 'delete', id, syncData);
      } else {
        // Try server-side permanent delete
        const { error } = await supabase
          .from('groups')
          .delete()
          .eq('id', id)
          .eq('master_user_id', masterUserId);

        if (error) throw error;
      }

      return true;
    } catch (error) {
      console.error('Error permanently deleting group:', error);
      throw new Error(handleDatabaseError(error));
    }
  }

  /**
   * Get groups with contact counts
   */
  async getGroupsWithContactCounts(): Promise<ContactGroup[]> {
    try {
      const groups = await this.getGroups();
      // The contact_count is automatically maintained by database triggers
      // For local data, we'll calculate it from contacts
      return await this.enrichGroupsWithContactCounts(groups);
    } catch (error) {
      console.error('Error fetching groups with contact counts:', error);
      throw new Error(handleDatabaseError(error));
    }
  }

  /**
   * Enrich groups with contact counts from local data
   */
  private async enrichGroupsWithContactCounts(groups: ContactGroup[]): Promise<ContactGroup[]> {
    try {
      const masterUserId = await this.getMasterUserId();

      // Get all contacts for this master user to calculate counts
      const contacts = await db.contacts
        .where('master_user_id')
        .equals(masterUserId)
        .and(contact => !contact._deleted)
        .toArray();

      // Create a map of group IDs to contact counts
      const contactCountMap = new Map<string, number>();

      contacts.forEach(contact => {
        const currentCount = contactCountMap.get(contact.group_id) || 0;
        contactCountMap.set(contact.group_id, currentCount + 1);
      });

      // Update groups with actual counts
      return groups.map(group => ({
        ...group,
        contact_count: contactCountMap.get(group.id) || 0
      }));
    } catch (error) {
      console.error('Error enriching groups with contact counts:', error);
      return groups; // Return original groups if calculation fails
    }
  }

  /**
   * Update group contact count (this is now handled by database triggers, so this method is deprecated)
   */
  async updateGroupContactCount(id: string): Promise<void> {
    try {
      // This method is kept for backward compatibility but contact_count
      // is now automatically maintained by database triggers
      await this.updateGroup(id, {}); // This will update the updated_at timestamp
    } catch (error) {
      console.error('Error updating group contact count:', error);
      // Don't throw error as this is now handled by database triggers
    }
  }

  /**
   * Get active groups only (exclude archived/deleted)
   */
  async getActiveGroups(): Promise<ContactGroup[]> {
    try {
      const masterUserId = await this.getMasterUserId();

      // Try local first
      let localGroups = await db.groups
        .where('master_user_id')
        .equals(masterUserId)
        .and(group => !group._deleted && group.is_active !== false)
        .toArray();

      if (localGroups.length > 0) {
        return this.transformLocalGroups(localGroups);
      }

      // Fallback to server
      const serverGroups = await this.fetchGroupsFromServer();
      return serverGroups.filter(group => group.is_active !== false);
    } catch (error) {
      console.error('Error fetching active groups:', error);
      throw new Error(handleDatabaseError(error));
    }
  }

  /**
   * Search groups by name or description
   */
  async searchGroups(query: string): Promise<ContactGroup[]> {
    try {
      const masterUserId = await this.getMasterUserId();

      // Try local first with search
      const localGroups = await db.groups
        .where('master_user_id')
        .equals(masterUserId)
        .and(group => !group._deleted && group.is_active !== false)
        .toArray();

      // Filter locally
      const filteredLocal = localGroups.filter(group =>
        group.name.toLowerCase().includes(query.toLowerCase()) ||
        (group.description && group.description.toLowerCase().includes(query.toLowerCase()))
      );

      if (filteredLocal.length > 0) {
        return this.transformLocalGroups(filteredLocal);
      }

      // Fallback to server search
      const serverGroups = await this.fetchGroupsFromServer();
      return serverGroups.filter(group =>
        group.name.toLowerCase().includes(query.toLowerCase()) ||
        (group.description && group.description.toLowerCase().includes(query.toLowerCase()))
      );
    } catch (error) {
      console.error('Error searching groups:', error);
      throw new Error(handleDatabaseError(error));
    }
  }

  /**
   * Get group statistics
   */
  async getGroupStats() {
    try {
      const groups = await this.getGroupsWithContactCounts();
      const activeGroups = groups.filter(g => g.is_active !== false);

      const totalContacts = activeGroups.reduce((sum, group) => sum + (group.contact_count || 0), 0);
      const largestGroup = activeGroups.reduce((largest, group) =>
        (group.contact_count || 0) > (largest.contact_count || 0) ? group : largest,
        activeGroups[0]
      );
      const averageGroupSize = activeGroups.length > 0
        ? Math.round(totalContacts / activeGroups.length)
        : 0;

      return {
        total: activeGroups.length,
        totalContacts,
        largestGroup: largestGroup || null,
        averageGroupSize
      };
    } catch (error) {
      console.error('Error fetching group stats:', error);
      throw new Error(handleDatabaseError(error));
    }
  }

  /**
   * Set up real-time subscription for group updates
   */
  subscribeToGroupUpdates(callback: (group: ContactGroup, eventType: 'INSERT' | 'UPDATE' | 'DELETE') => void) {
    this.unsubscribeFromGroupUpdates();

    this.realtimeChannel = supabase
      .channel('groups')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'groups'
        },
        async (payload) => {
          const { new: newRecord, old: oldRecord, eventType } = payload;

          if (eventType === 'DELETE') {
            // Transform old record with standardized timestamps
            const transformedOld = standardizeForService(oldRecord, 'group');
            callback(transformedOld as ContactGroup, 'DELETE');
          } else {
            // Transform new record with standardized timestamps
            const transformedNew = standardizeForService(newRecord, 'group');
            callback(transformedNew as ContactGroup, eventType as 'INSERT' | 'UPDATE');
          }
        }
      )
      .subscribe();
  }

  /**
   * Subscribe to group updates for a specific master user
   */
  subscribeToGroupUpdatesForMaster(masterUserId: string, callback: (group: ContactGroup, eventType: 'INSERT' | 'UPDATE' | 'DELETE') => void) {
    this.unsubscribeFromGroupUpdates();

    this.realtimeChannel = supabase
      .channel(`groups_${masterUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'groups',
          filter: `master_user_id=eq.${masterUserId}`
        },
        async (payload) => {
          const { new: newRecord, old: oldRecord, eventType } = payload;

          if (eventType === 'DELETE') {
            // Transform old record with standardized timestamps
            const transformedOld = standardizeForService(oldRecord, 'group');
            callback(transformedOld as ContactGroup, 'DELETE');
          } else {
            // Transform new record with standardized timestamps
            const transformedNew = standardizeForService(newRecord, 'group');
            callback(transformedNew as ContactGroup, eventType as 'INSERT' | 'UPDATE');
          }
        }
      )
      .subscribe();
  }

  /**
   * Unsubscribe from group updates
   */
  unsubscribeFromGroupUpdates() {
    if (this.realtimeChannel) {
      supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
  }

  /**
   * Check if a group name already exists for the current master user
   */
  async isGroupNameTaken(name: string, excludeId?: string): Promise<boolean> {
    try {
      const masterUserId = await this.getMasterUserId();

      // Check local first
      const localGroups = await db.groups
        .where('master_user_id')
        .equals(masterUserId)
        .and(group => !group._deleted && group.is_active !== false)
        .toArray();

      const localMatch = localGroups.find(group =>
        group.name.toLowerCase() === name.toLowerCase() &&
        group.id !== excludeId
      );

      if (localMatch) return true;

      // Also check server for consistency
      let query = supabase
        .from('groups')
        .select('id')
        .eq('master_user_id', masterUserId)
        .eq('name', name)
        .eq('is_active', true);

      if (excludeId) {
        query = query.neq('id', excludeId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data?.length || 0) > 0;
    } catch (error) {
      console.error('Error checking group name:', error);
      return false;
    }
  }

  /**
   * Force sync with server
   */
  async forceSync(): Promise<void> {
    await this.syncManager.triggerSync();
  }

  /**
   * Get sync status for groups
   */
  async getSyncStatus() {
    const localGroups = await db.groups
      .where('master_user_id')
      .equals(await this.getMasterUserId())
      .and(group => !group._deleted)
      .toArray();

    const pending = localGroups.filter(g => g._syncStatus === 'pending').length;
    const synced = localGroups.filter(g => g._syncStatus === 'synced').length;
    const conflicts = localGroups.filter(g => g._syncStatus === 'conflict').length;

    return {
      total: localGroups.length,
      pending,
      synced,
      conflicts,
      syncManagerStatus: this.syncManager.getStatus()
    };
  }

  /**
   * Clean up subscriptions when service is destroyed
   */
  destroy() {
    this.unsubscribeFromGroupUpdates();
    this.syncManager.destroy();
  }
}
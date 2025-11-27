import { Contact, ContactWithGroup } from './types';
import { supabase, handleDatabaseError } from '../supabase';
import { db, LocalContact } from '../db';
import { SyncManager } from '../sync/SyncManager';
import { userContextManager } from '../security/UserContextManager';
import {
  toISOString,
  localToSupabase,
  addSyncMetadata,
  addTimestamps,
  standardizeForService
} from '../utils/timestamp';
import {
  validateContact,
  isValidUUID,
  logValidationError,
  sanitizeString,
  sanitizeBoolean,
  isValidPhoneNumber,
  sanitizeArray
} from '../utils/validation';
import type { RealtimeChannel } from '@supabase/supabase-js';

export class ContactService {
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
      if (event.table === 'contacts') {
        switch (event.type) {
          case 'sync_complete':
            // Refresh local contacts after sync
            this.refreshFromSync();
            break;
          case 'sync_error':
            console.error('Contact sync error:', event.error);
            break;
        }
      }
    });
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
   * Background sync contacts without blocking the main operation
   */
  private async backgroundSyncContacts(): Promise<void> {
    try {
      // Don't await this to avoid blocking the main operation
      this.syncManager.triggerSync().catch(error => {
        console.warn('Background sync failed:', error);
      });
    } catch (error) {
      console.warn('Failed to trigger background sync:', error);
    }
  }

  /**
   * Get the current authenticated user
   */
  private async getCurrentUser() {
    const user = await userContextManager.getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    return user;
  }

  /**
   * Get master user ID (for multi-tenant support)
   */
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
   * Refresh local contacts from sync results
   */
  private async refreshFromSync() {
    // This will be called when sync completes
    // No action needed as the sync manager handles local updates
  }

  /**
   * Transform local contacts to match interface using standardized timestamps with comprehensive type validation
   */
  private transformLocalContacts(localContacts: LocalContact[]): ContactWithGroup[] {
    return localContacts.map(contact => {
      try {
        // Validate the contact data first
        const validatedContact = validateContact(contact);
        if (!validatedContact) {
          console.error('Invalid contact data during transformation:', contact);
          // Return a minimal valid contact to prevent system failure
          return {
            id: contact.id || crypto.randomUUID(),
            name: 'Invalid Contact',
            phone: '',
            group_id: contact.group_id || '',
            master_user_id: contact.master_user_id || '',
            created_by: contact.created_by || '',
            tags: [],
            notes: '',
            is_blocked: false,
            created_at: toISOString(new Date()),
            updated_at: toISOString(new Date())
          } as ContactWithGroup;
        }

        // Apply standardized timestamp transformation
        const standardized = standardizeForService(validatedContact, 'contact');

        // Ensure all required fields are properly typed
        const transformed: ContactWithGroup = {
          ...standardized,
          name: sanitizeString(standardized.name, 'name', 255),
          phone: sanitizeString(standardized.phone, 'phone', 20),
          tags: sanitizeArray(standardized.tags, 'tags', (tag): tag is string => typeof tag === 'string'),
          notes: sanitizeString(standardized.notes, 'notes', 1000),
          is_blocked: sanitizeBoolean(standardized.is_blocked, 'is_blocked'),
          groups: undefined // Will be enriched separately
        };

        // Validate critical fields
        if (!isValidUUID(transformed.id)) {
          console.warn('Invalid contact ID, generating new UUID:', transformed.id);
          transformed.id = crypto.randomUUID();
        }

        if (!isValidUUID(transformed.master_user_id)) {
          console.warn('Invalid contact master_user_id:', transformed.master_user_id);
        }

        if (!transformed.phone || !isValidPhoneNumber(transformed.phone)) {
          console.warn('Invalid contact phone number:', transformed.phone);
        }

        return transformed;
      } catch (error) {
        logValidationError('transform', 'contact', contact, error);
        // Return a safe fallback contact
        return {
          id: contact.id || crypto.randomUUID(),
          name: 'Error Contact',
          phone: '',
          group_id: contact.group_id || '',
          master_user_id: contact.master_user_id || '',
          created_by: contact.created_by || '',
          tags: [],
          notes: '',
          is_blocked: false,
          created_at: toISOString(new Date()),
          updated_at: toISOString(new Date())
        } as ContactWithGroup;
      }
    });
  }

  /**
   * Get all contacts for the current user's master account
   * Prioritizes local data, falls back to server if needed
   * Enforces data isolation using UserContextManager
   * Enhanced with offline-first approach and better error handling
   */
  async getContacts(): Promise<ContactWithGroup[]> {
    try {
      // RLS policies handle data isolation at the database level
      const masterUserId = await this.getMasterUserId();

      // Check online status and prioritize accordingly
      const isOnline = this.syncManager.getIsOnline();

      // First, try to get from local database
      let localContacts = await db.contacts
        .where('master_user_id')
        .equals(masterUserId)
        .and(contact => !contact._deleted)
        .toArray();

      // If we have local data, return it immediately (offline-first approach)
      if (localContacts.length > 0) {
        // Enrich with group data
        const enrichedContacts = await this.enrichContactsWithGroups(localContacts);

        // If online, trigger background sync to update local data
        if (isOnline) {
          this.backgroundSyncContacts().catch(console.warn);
        }

        return enrichedContacts;
      }

      // No local data available
      if (isOnline) {
        try {
          // Try to sync from server
          await this.syncManager.triggerSync();

          // Try local again after sync
          localContacts = await db.contacts
            .where('master_user_id')
            .equals(masterUserId)
            .and(contact => !contact._deleted)
            .toArray();

          if (localContacts.length > 0) {
            return await this.enrichContactsWithGroups(localContacts);
          }
        } catch (syncError) {
          console.warn('Sync failed, trying direct server fetch:', syncError);
        }

        // Fallback to direct server fetch
        return await this.fetchContactsFromServer();
      } else {
        // Offline mode: return empty array or cached data
        console.log('Operating in offline mode - no contacts available locally');
        return [];
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);

      // Enhanced error handling with offline fallback
      const isOnline = this.syncManager.getIsOnline();
      if (!isOnline) {
        // In offline mode, try to return whatever local data we have
        try {
          const masterUserId = await this.getMasterUserId();
          const localContacts = await db.contacts
            .where('master_user_id')
            .equals(masterUserId)
            .and(contact => !contact._deleted)
            .toArray();

          if (localContacts.length > 0) {
            return await this.enrichContactsWithGroups(localContacts);
          }
        } catch (offlineError) {
          console.error('Even offline fallback failed:', offlineError);
        }

        return [];
      }

      // Online mode fallback to server
      try {
        return await this.fetchContactsFromServer();
      } catch (serverError) {
        console.error('Server fetch also failed:', serverError);
        throw new Error(`Failed to fetch contacts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Enrich contacts with group information
   */
  private async enrichContactsWithGroups(contacts: LocalContact[]): Promise<ContactWithGroup[]> {
    const groupIds = [...new Set(contacts.map(c => c.group_id))];

    if (groupIds.length === 0) {
      return this.transformLocalContacts(contacts);
    }

    const localGroups = await db.groups
      .where('id')
      .anyOf(groupIds)
      .toArray();

    const groupMap = new Map(localGroups.map(g => [g.id, g]));

    return contacts.map(contact => ({
      ...this.transformLocalContacts([contact])[0],
      groups: contact.group_id ? groupMap.get(contact.group_id) : undefined
    }));
  }

  /**
   * Fetch contacts directly from server
   */
  private async fetchContactsFromServer(): Promise<ContactWithGroup[]> {
    await this.getCurrentUser(); // Ensure user is authenticated
    const masterUserId = await this.getMasterUserId();

    const { data, error } = await supabase
      .from('contacts')
      .select(`
        *,
        groups (
          id,
          name,
          color
        )
      `)
      .eq('master_user_id', masterUserId)
      .eq('is_blocked', false)
      .order('name');

    if (error) throw error;

    // Transform server data to match interface with standardized timestamps
    return (data || []).map(contact => {
      const standardized = standardizeForService(contact, 'contact');
      return {
        ...standardized,
        groups: contact.groups
      };
    }) as ContactWithGroup[];
  }

  /**
   * Get contacts filtered by group ID
   */
  async getContactsByGroupId(groupId: string): Promise<ContactWithGroup[]> {
    try {
      const masterUserId = await this.getMasterUserId();

      // Try local first
      let localContacts = await db.contacts
        .where('master_user_id')
        .equals(masterUserId)
        .and(contact => !contact._deleted && contact.group_id === groupId)
        .toArray();

      if (localContacts.length > 0) {
        return await this.enrichContactsWithGroups(localContacts);
      }

      // Fallback to server
      const serverContacts = await this.fetchContactsFromServer();
      return serverContacts.filter(contact => contact.group_id === groupId);
    } catch (error) {
      console.error('Error fetching contacts by group:', error);
      throw new Error(handleDatabaseError(error));
    }
  }

  /**
   * Get contacts filtered by multiple group IDs
   */
  async getContactsByGroupIds(groupIds: string[]): Promise<ContactWithGroup[]> {
    try {
      const masterUserId = await this.getMasterUserId();

      // Try local first
      let localContacts = await db.contacts
        .where('master_user_id')
        .equals(masterUserId)
        .and(contact => !contact._deleted && groupIds.includes(contact.group_id))
        .toArray();

      if (localContacts.length > 0) {
        return await this.enrichContactsWithGroups(localContacts);
      }

      // Fallback to server
      const serverContacts = await this.fetchContactsFromServer();
      return serverContacts.filter(contact => groupIds.includes(contact.group_id));
    } catch (error) {
      console.error('Error fetching contacts by groups:', error);
      throw new Error(handleDatabaseError(error));
    }
  }

  /**
   * Alias for getContacts (for backward compatibility)
   */
  async getAllContacts(): Promise<Contact[]> {
    const contacts = await this.getContacts();
    return contacts;
  }

  /**
   * Search contacts by name, phone, or tags
   */
  async searchContacts(query: string): Promise<ContactWithGroup[]> {
    try {
      const masterUserId = await this.getMasterUserId();

      // Try local first with search
      const localContacts = await db.contacts
        .where('master_user_id')
        .equals(masterUserId)
        .and(contact => !contact._deleted)
        .toArray();

      // Filter locally
      const filteredLocal = localContacts.filter(contact =>
        contact.name.toLowerCase().includes(query.toLowerCase()) ||
        contact.phone.includes(query) ||
        contact.tags?.some((tag: string) => tag.toLowerCase().includes(query.toLowerCase()))
      );

      if (filteredLocal.length > 0) {
        return await this.enrichContactsWithGroups(filteredLocal);
      }

      // Fallback to server search
      const serverContacts = await this.fetchContactsFromServer();
      return serverContacts.filter(contact =>
        contact.name.toLowerCase().includes(query.toLowerCase()) ||
        contact.phone.includes(query) ||
        contact.tags?.some((tag: string) => tag.toLowerCase().includes(query.toLowerCase()))
      );
    } catch (error) {
      console.error('Error searching contacts:', error);
      throw new Error(handleDatabaseError(error));
    }
  }

  /**
   * Get a single contact by ID
   */
  async getContactById(id: string): Promise<ContactWithGroup | null> {
    try {
      const masterUserId = await this.getMasterUserId();

      // Try local first
      const localContact = await db.contacts.get(id);

      if (localContact && !localContact._deleted && localContact.master_user_id === masterUserId) {
        const enriched = await this.enrichContactsWithGroups([localContact]);
        return enriched[0] || null;
      }

      // Fallback to server
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          *,
          groups (
            id,
            name,
            color
          )
        `)
        .eq('id', id)
        .eq('master_user_id', masterUserId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // No rows returned
        throw error;
      }

      // Transform with standardized timestamps
      const standardized = standardizeForService(data, 'contact');
      return {
        ...standardized,
        groups: data.groups
      } as ContactWithGroup;
    } catch (error) {
      console.error('Error fetching contact by ID:', error);
      throw new Error(handleDatabaseError(error));
    }
  }

  /**
   * Create a new contact - local first with sync
   * Enhanced with offline/online handling and better error recovery
   * Enforces data isolation using UserContextManager
   */
  async createContact(contactData: Omit<Contact, 'id' | 'created_at' | 'updated_at' | 'master_user_id' | 'created_by'>): Promise<ContactWithGroup> {
    try {
      // Enforce data isolation - check user context and permissions
      const hasPermission = await userContextManager.canPerformAction('create_contacts', 'contacts');
      if (!hasPermission) {
        throw new Error('Access denied: insufficient permissions to create contacts');
      }

      const user = await this.getCurrentUser();
      const masterUserId = await this.getMasterUserId();
      const isOnline = this.syncManager.getIsOnline();

      // Use standardized timestamp utilities
      const timestamps = addTimestamps({}, false);
      const syncMetadata = addSyncMetadata({}, false);

      // Prepare local contact data with required timestamps
      const newLocalContact: Omit<LocalContact, 'id'> = {
        ...contactData,
        master_user_id: masterUserId,
        created_by: user.id,
        is_blocked: contactData.is_blocked || false,
        created_at: timestamps.created_at,
        updated_at: timestamps.updated_at,
        _syncStatus: syncMetadata._syncStatus,
        _lastModified: syncMetadata._lastModified,
        _version: syncMetadata._version,
        _deleted: false
      };

      // Add to local database first (always works in offline mode)
      const contactId = crypto.randomUUID();
      const localContact = {
        id: contactId,
        ...newLocalContact
      };

      await db.contacts.add(localContact);

      // Transform for sync queue (convert Date objects to ISO strings)
      const syncData = localToSupabase(localContact);

      // Try to sync immediately if online, otherwise queue for later
      if (isOnline) {
        try {
          await this.syncManager.addToSyncQueue('contacts', 'create', contactId, syncData);
        } catch (syncError) {
          console.warn('Immediate sync failed, will retry later:', syncError);
          // Still add to queue for later retry
          this.syncManager.addToSyncQueue('contacts', 'create', contactId, syncData)
            .catch(console.error);
        }
      } else {
        // Offline mode: queue for later sync
        await this.syncManager.addToSyncQueue('contacts', 'create', contactId, syncData);
      }

      // Enrich with group data for return
      const enriched = await this.enrichContactsWithGroups([localContact]);
      return enriched[0];
    } catch (error) {
      console.error('Error creating contact:', error);

      // Enhanced error handling
      if (error instanceof Error) {
        throw new Error(`Failed to create contact: ${error.message}`);
      }
      throw new Error('Failed to create contact: Unknown error');
    }
  }

  /**
   * Create multiple contacts efficiently
   */
  async createContacts(contactsData: Omit<Contact, 'id' | 'created_at' | 'updated_at' | 'master_user_id' | 'created_by'>[]): Promise<{ success: boolean; created: number; errors: string[] }> {
    try {
      const hasPermission = await userContextManager.canPerformAction('create_contacts', 'contacts');
      if (!hasPermission) {
        throw new Error('Access denied: insufficient permissions to create contacts');
      }

      const user = await this.getCurrentUser();
      const masterUserId = await this.getMasterUserId();
      const isOnline = this.syncManager.getIsOnline();
      const timestamps = addTimestamps({}, false);
      const syncMetadata = addSyncMetadata({}, false);

      const localContacts: LocalContact[] = [];
      const syncQueueItems: any[] = [];
      const errors: string[] = [];

      for (const contactData of contactsData) {
        try {
          const contactId = crypto.randomUUID();
          const newLocalContact: Omit<LocalContact, 'id'> = {
            ...contactData,
            master_user_id: masterUserId,
            created_by: user.id,
            is_blocked: contactData.is_blocked || false,
            created_at: timestamps.created_at,
            updated_at: timestamps.updated_at,
            _syncStatus: syncMetadata._syncStatus,
            _lastModified: syncMetadata._lastModified,
            _version: syncMetadata._version,
            _deleted: false
          };

          const localContact = { id: contactId, ...newLocalContact };
          localContacts.push(localContact);

          // Prepare sync data
          const syncData = localToSupabase(localContact);
          syncQueueItems.push({
            table: 'contacts',
            type: 'create',
            id: contactId,
            data: syncData
          });

        } catch (err) {
          errors.push(`Failed to prepare contact ${contactData.name}: ${err}`);
        }
      }

      if (localContacts.length > 0) {
        // Bulk add to local DB
        await db.contacts.bulkAdd(localContacts);

        // Queue sync items
        for (const item of syncQueueItems) {
          this.syncManager.addToSyncQueue(item.table, item.type, item.id, item.data)
            .catch(e => console.warn('Failed to queue sync item:', e));
        }

        // Trigger sync if online
        if (isOnline) {
          this.backgroundSyncContacts();
        }
      }

      return {
        success: errors.length === 0,
        created: localContacts.length,
        errors
      };

    } catch (error) {
      console.error('Error creating multiple contacts:', error);
      return {
        success: false,
        created: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Update an existing contact - local first with sync
   * Enforces data isolation using UserContextManager
   */
  async updateContact(id: string, contactData: Partial<Omit<Contact, 'id' | 'created_at' | 'updated_at' | 'master_user_id' | 'created_by'>>): Promise<ContactWithGroup | null> {
    try {
      // Enforce data isolation - check user context and permissions
      const hasPermission = await userContextManager.canPerformAction('update_contacts', 'contacts');
      if (!hasPermission) {
        throw new Error('Access denied: insufficient permissions to update contacts');
      }

      const user = await this.getCurrentUser();
      const masterUserId = await this.getMasterUserId();

      // Check if contact exists locally
      const existingContact = await db.contacts.get(id);

      if (!existingContact || existingContact._deleted) {
        // Contact doesn't exist locally, try server
        const serverContact = await this.getContactById(id);
        if (!serverContact) {
          throw new Error('Contact not found');
        }
      }

      // Use standardized timestamp utilities for updates
      const timestamps = addTimestamps({}, true);
      const syncMetadata = addSyncMetadata(existingContact, true);

      // Prepare update data
      const updateData = {
        ...contactData,
        updated_at: timestamps.updated_at,
        _syncStatus: syncMetadata._syncStatus,
        _lastModified: syncMetadata._lastModified,
        _version: syncMetadata._version
      };

      // Update local database
      await db.contacts.update(id, updateData);

      // Get updated record for sync
      const updatedContact = await db.contacts.get(id);
      if (updatedContact) {
        // Transform for sync queue (convert Date objects to ISO strings)
        const syncData = localToSupabase(updatedContact);
        await this.syncManager.addToSyncQueue('contacts', 'update', id, syncData);

        // Enrich and return
        const enriched = await this.enrichContactsWithGroups([updatedContact]);
        return enriched[0] || null;
      }

      return null;
    } catch (error) {
      console.error('Error updating contact:', error);
      throw new Error(handleDatabaseError(error));
    }
  }

  /**
   * Delete a contact - soft delete locally with sync
   * Enforces data isolation using UserContextManager
   */
  async deleteContact(id: string): Promise<boolean> {
    try {
      // Enforce data isolation - check user context and permissions
      const hasPermission = await userContextManager.canPerformAction('delete_contacts', 'contacts');
      if (!hasPermission) {
        throw new Error('Access denied: insufficient permissions to delete contacts');
      }

      const masterUserId = await this.getMasterUserId();

      // Check if contact exists
      const existingContact = await db.contacts.get(id);

      if (!existingContact || existingContact._deleted) {
        // Try server-side delete if not found locally
        await this.deleteContactFromServer(id);
        return true;
      }

      // Use standardized sync metadata for soft delete
      const syncMetadata = addSyncMetadata(existingContact, true);

      // Soft delete locally
      await db.contacts.update(id, {
        _syncStatus: syncMetadata._syncStatus,
        _lastModified: syncMetadata._lastModified,
        _version: syncMetadata._version,
        _deleted: true
      });

      // Transform for sync queue (convert Date objects to ISO strings)
      const syncData = localToSupabase(existingContact);
      await this.syncManager.addToSyncQueue('contacts', 'delete', id, syncData);

      return true;
    } catch (error) {
      console.error('Error deleting contact:', error);
      throw new Error(handleDatabaseError(error));
    }
  }

  /**
   * Delete contact from server (fallback)
   */
  private async deleteContactFromServer(id: string): Promise<void> {
    const masterUserId = await this.getMasterUserId();

    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', id)
      .eq('master_user_id', masterUserId);

    if (error) throw error;
  }

  /**
   * Delete multiple contacts
   */
  async deleteMultipleContacts(ids: string[]): Promise<{ success: boolean; deletedCount: number }> {
    try {
      await this.getMasterUserId(); // Ensure initialized

      let deletedCount = 0;

      for (const id of ids) {
        try {
          await this.deleteContact(id);
          deletedCount++;
        } catch (error) {
          console.error(`Error deleting contact ${id}:`, error);
        }
      }

      return {
        success: deletedCount === ids.length,
        deletedCount
      };
    } catch (error) {
      console.error('Error deleting multiple contacts:', error);
      return {
        success: false,
        deletedCount: 0
      };
    }
  }

  /**
   * Upload contacts from file (CSV/Excel)
   */
  /**
   * Upload contacts from file (CSV/Excel)
   * Now uses the xlsHandler utility in the UI layer to parse, this method receives structured data
   * But keeping this for backward compatibility or direct file handling if needed
   */
  async uploadContacts(file: File): Promise<{ success: boolean; uploaded: number; errors?: string[] }> {
    // This method is deprecated in favor of UI-layer parsing + createContacts
    // But we'll implement a basic version just in case
    // Prevent unused variable warning
    if (!file) return { success: false, uploaded: 0 };

    return {
      success: false,
      uploaded: 0,
      errors: ['Please use the new import functionality']
    };
  }


  /**
   * Set up real-time subscription for contact updates
   */
  subscribeToContactUpdates(callback: (contact: ContactWithGroup, eventType: 'INSERT' | 'UPDATE' | 'DELETE') => void) {
    this.unsubscribeFromContactUpdates();

    this.realtimeChannel = supabase
      .channel('contacts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contacts'
        },
        async (payload) => {
          const { new: newRecord, old: oldRecord, eventType } = payload;

          if (eventType === 'DELETE') {
            // Transform old record with standardized timestamps
            const transformedOld = standardizeForService(oldRecord, 'contact');
            callback(transformedOld as ContactWithGroup, 'DELETE');
          } else {
            // Transform new record with standardized timestamps
            const transformedNew = standardizeForService(newRecord, 'contact');
            callback(transformedNew as ContactWithGroup, eventType as 'INSERT' | 'UPDATE');
          }
        }
      )
      .subscribe();
  }

  /**
   * Unsubscribe from contact updates
   */
  unsubscribeFromContactUpdates() {
    if (this.realtimeChannel) {
      supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
  }

  /**
   * Get contact statistics
   */
  async getContactStats() {
    try {
      const masterUserId = await this.getMasterUserId();

      // Try local first
      const localContacts = await db.contacts
        .where('master_user_id')
        .equals(masterUserId)
        .and(contact => !contact._deleted)
        .toArray();

      if (localContacts.length > 0) {
        const total = localContacts.length;
        const blocked = localContacts.filter(c => c.is_blocked).length;
        const active = total - blocked;

        return {
          total,
          active,
          blocked
        };
      }

      // Fallback to server
      const { data, error } = await supabase
        .from('contacts')
        .select('is_blocked')
        .eq('master_user_id', masterUserId);

      if (error) throw error;

      const total = data?.length || 0;
      const blocked = data?.filter(c => c.is_blocked).length || 0;
      const active = total - blocked;

      return {
        total,
        active,
        blocked
      };
    } catch (error) {
      console.error('Error fetching contact stats:', error);
      throw new Error(handleDatabaseError(error));
    }
  }

  /**
   * Force sync with server
   */
  async forceSync(): Promise<void> {
    await this.syncManager.triggerSync();
  }

  /**
   * Get sync status for contacts
   */
  async getSyncStatus() {
    const localContacts = await db.contacts
      .where('master_user_id')
      .equals(await this.getMasterUserId())
      .and(contact => !contact._deleted)
      .toArray();

    const pending = localContacts.filter(c => c._syncStatus === 'pending').length;
    const synced = localContacts.filter(c => c._syncStatus === 'synced').length;
    const conflicts = localContacts.filter(c => c._syncStatus === 'conflict').length;

    return {
      total: localContacts.length,
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
    this.unsubscribeFromContactUpdates();
    this.syncManager.destroy();
  }
}
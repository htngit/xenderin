import { ActivityLog, MessageLog } from './types';
import { supabase, handleDatabaseError } from '../supabase';
import { db, LocalActivityLog } from '../db';
import { SyncManager } from '../sync/SyncManager';
import { userContextManager } from '../security/UserContextManager';
import {
  toISOString,
  fromISOString,
  supabaseToLocal,
  localToSupabase,
  addSyncMetadata,
  addTimestamps,
  standardizeForService
} from '../utils/timestamp';
import type { RealtimeChannel } from '@supabase/supabase-js';

export class HistoryService {
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
      if (event.table === 'activityLogs') {
        switch (event.type) {
          case 'sync_complete':
            console.log('History sync completed');
            break;
          case 'sync_error':
            console.error('History sync error:', event.error);
            break;
          case 'conflict_detected':
            console.warn('History conflict detected:', event.message);
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
    try {
      await this.syncManager.triggerSync();
    } catch (error) {
      console.warn('Initial sync failed, will retry later:', error);
    }
  }

  /**
   * Check online status with timeout and fallback
   */
  private async checkOnlineStatus(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

      const response = await fetch('/api/ping', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.log('Network check failed, assuming offline mode:', error);
      return false;
    }
  }

  /**
   * Background sync history without blocking the main operation
   */
  private async backgroundSyncHistory(): Promise<void> {
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
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
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
   * Transform local activity logs to match interface using standardized timestamps
   */
  private transformLocalLogs(localLogs: LocalActivityLog[]): ActivityLog[] {
    return localLogs.map(log => {
      // Use standardized timestamp transformation
      const standardized = standardizeForService(log, 'history');
      return {
        id: standardized.id,
        user_id: standardized.user_id,
        master_user_id: standardized.master_user_id,
        contact_group_id: standardized.contact_group_id || undefined,
        template_id: standardized.template_id || undefined,
        template_name: standardized.template_name || undefined,
        total_contacts: standardized.total_contacts,
        success_count: standardized.success_count,
        failed_count: standardized.failed_count,
        status: standardized.status,
        delay_range: standardized.delay_range,
        scheduled_for: standardized.scheduled_for || undefined,
        started_at: standardized.started_at || undefined,
        completed_at: standardized.completed_at || undefined,
        error_message: standardized.error_message || undefined,
        metadata: standardized.metadata || undefined,
        created_at: standardized.created_at,
        updated_at: standardized.updated_at
      };
    });
  }

  /**
   * Get all activity logs for the current user's master account
   * Prioritizes local data, falls back to server if needed
   * Enforces data isolation using UserContextManager
   * Enhanced with offline-first approach and better error handling
   */
  async getActivityLogs(): Promise<ActivityLog[]> {
    try {
      // Enforce data isolation - check user context
      const hasPermission = await userContextManager.canPerformAction('read_history', 'history');
      if (!hasPermission) {
        throw new Error('Access denied: insufficient permissions to read activity logs');
      }

      const masterUserId = await this.getMasterUserId();

      // Check online status and prioritize accordingly
      const isOnline = await this.checkOnlineStatus();

      // First, try to get from local database
      let localLogs = await db.activityLogs
        .where('master_user_id')
        .equals(masterUserId)
        .and(log => !log._deleted)
        .toArray();

      // If we have local data, return it immediately (offline-first approach)
      if (localLogs.length > 0) {
        const transformedLogs = this.transformLocalLogs(localLogs);

        // If online, trigger background sync to update local data
        if (isOnline) {
          this.backgroundSyncHistory().catch(console.warn);
        }

        return transformedLogs;
      }

      // No local data available
      if (isOnline) {
        try {
          // Try to sync from server
          await this.syncManager.triggerSync();

          // Try local again after sync
          localLogs = await db.activityLogs
            .where('master_user_id')
            .equals(masterUserId)
            .and(log => !log._deleted)
            .toArray();

          if (localLogs.length > 0) {
            return this.transformLocalLogs(localLogs);
          }
        } catch (syncError) {
          console.warn('Sync failed, trying direct server fetch:', syncError);
        }

        // Fallback to direct server fetch
        return await this.fetchLogsFromServer();
      } else {
        // Offline mode: return empty array or cached data
        console.log('Operating in offline mode - no activity logs available locally');
        return [];
      }
    } catch (error) {
      console.error('Error fetching activity logs:', error);

      // Enhanced error handling with offline fallback
      const isOnline = await this.checkOnlineStatus();
      if (!isOnline) {
        // In offline mode, try to return whatever local data we have
        try {
          const masterUserId = await this.getMasterUserId();
          const localLogs = await db.activityLogs
            .where('master_user_id')
            .equals(masterUserId)
            .and(log => !log._deleted)
            .toArray();

          if (localLogs.length > 0) {
            return this.transformLocalLogs(localLogs);
          }
        } catch (offlineError) {
          console.error('Even offline fallback failed:', offlineError);
        }

        return [];
      }

      // Online mode fallback to server
      try {
        return await this.fetchLogsFromServer();
      } catch (serverError) {
        console.error('Server fetch also failed:', serverError);
        throw new Error(`Failed to fetch activity logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Fetch activity logs directly from server
   */
  private async fetchLogsFromServer(): Promise<ActivityLog[]> {
    const masterUserId = await this.getMasterUserId();

    const { data, error } = await supabase
      .from('history')
      .select(`
        *,
        groups (
          id,
          name,
          color
        ),
        templates (
          id,
          name
        )
      `)
      .eq('master_user_id', masterUserId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Transform data to match ActivityLog interface with standardized timestamps
    return (data || []).map(log => {
      const standardized = standardizeForService(log, 'history');
      return {
        id: standardized.id,
        user_id: standardized.user_id,
        master_user_id: standardized.master_user_id,
        contact_group_id: standardized.contact_group_id || undefined,
        template_id: standardized.template_id || undefined,
        template_name: standardized.template_name || undefined,
        total_contacts: standardized.total_contacts,
        success_count: standardized.success_count,
        failed_count: standardized.failed_count,
        status: standardized.status,
        delay_range: standardized.delay_range,
        scheduled_for: standardized.scheduled_for || undefined,
        started_at: standardized.started_at || undefined,
        completed_at: standardized.completed_at || undefined,
        error_message: standardized.error_message || undefined,
        metadata: standardized.metadata || undefined,
        created_at: standardized.created_at,
        updated_at: standardized.updated_at
      };
    });
  }

  /**
   * Get activity logs filtered by status
   */
  async getLogsByStatus(status: ActivityLog['status']): Promise<ActivityLog[]> {
    try {
      const masterUserId = await this.getMasterUserId();

      // Try local first
      let localLogs = await db.activityLogs
        .where('master_user_id')
        .equals(masterUserId)
        .and(log => !log._deleted && log.status === status)
        .toArray();

      if (localLogs.length > 0) {
        return this.transformLocalLogs(localLogs);
      }

      // Fallback to server
      const serverLogs = await this.fetchLogsFromServer();
      return serverLogs.filter(log => log.status === status);
    } catch (error) {
      console.error('Error fetching logs by status:', error);
      throw new Error(handleDatabaseError(error));
    }
  }

  /**
   * Get activity logs filtered by date range
   */
  async getLogsByDateRange(startDate: string, endDate: string): Promise<ActivityLog[]> {
    try {
      const masterUserId = await this.getMasterUserId();

      // Try local first
      let localLogs = await db.activityLogs
        .where('master_user_id')
        .equals(masterUserId)
        .and(log => {
          if (log._deleted) return false;
          const logDate = new Date(log.created_at);
          return logDate >= new Date(startDate) && logDate <= new Date(endDate);
        })
        .toArray();

      if (localLogs.length > 0) {
        return this.transformLocalLogs(localLogs);
      }

      // Fallback to server
      const serverLogs = await this.fetchLogsFromServer();
      return serverLogs.filter(log => {
        const logDate = new Date(log.created_at);
        return logDate >= new Date(startDate) && logDate <= new Date(endDate);
      });
    } catch (error) {
      console.error('Error fetching logs by date range:', error);
      throw new Error(handleDatabaseError(error));
    }
  }

  /**
   * Create a new activity log entry - local first with sync
   * Enforces data isolation using UserContextManager
   */
  async createLog(logData: Omit<ActivityLog, 'id' | 'started_at' | 'created_at' | 'updated_at'>): Promise<ActivityLog> {
    try {
      // Enforce data isolation - check user context and permissions
      const hasPermission = await userContextManager.canPerformAction('create_history', 'history');
      if (!hasPermission) {
        throw new Error('Access denied: insufficient permissions to create activity logs');
      }

      const user = await this.getCurrentUser();
      const masterUserId = await this.getMasterUserId();

      // Use standardized timestamp utilities
      const timestamps = addTimestamps({}, false);
      const syncMetadata = addSyncMetadata({}, false);

      // Prepare local activity log data
      const newLocalLog: Omit<LocalActivityLog, 'id'> = {
        ...logData,
        user_id: user.id,
        master_user_id: masterUserId,
        contact_group_id: logData.contact_group_id || undefined,
        template_id: logData.template_id || undefined,
        template_name: logData.template_name || undefined,
        total_contacts: logData.total_contacts,
        success_count: logData.success_count,
        failed_count: logData.failed_count,
        status: logData.status,
        delay_range: logData.delay_range,
        scheduled_for: logData.scheduled_for || undefined,
        started_at: toISOString(new Date()), // Set started_at to now
        completed_at: logData.completed_at || undefined,
        error_message: logData.error_message || undefined,
        metadata: logData.metadata || undefined,
        created_at: timestamps.created_at,
        updated_at: timestamps.updated_at,
        _syncStatus: syncMetadata._syncStatus,
        _lastModified: syncMetadata._lastModified,
        _version: syncMetadata._version,
        _deleted: false
      };

      // Add to local database first
      const logId = crypto.randomUUID();
      const localLog = {
        id: logId,
        ...newLocalLog
      };

      await db.activityLogs.add(localLog);

      // Transform for sync queue (convert Date objects to ISO strings)
      const syncData = localToSupabase(localLog);
      await this.syncManager.addToSyncQueue('activityLogs', 'create', logId, syncData);

      // Return transformed log
      return this.transformLocalLogs([localLog])[0];
    } catch (error) {
      console.error('Error creating activity log:', error);
      throw new Error(handleDatabaseError(error));
    }
  }

  /**
   * Update log status and completion details - local first with sync
   */
  async updateLogStatus(
    id: string,
    status: ActivityLog['status'],
    completedAt?: string,
    errorMessage?: string
  ): Promise<void> {
    try {
      const masterUserId = await this.getMasterUserId();

      // Check if log exists locally
      const existingLog = await db.activityLogs.get(id);

      if (!existingLog || existingLog._deleted) {
        // Log doesn't exist locally, try server
        const serverLog = await this.getLogById(id);
        if (!serverLog) {
          throw new Error('Activity log not found');
        }
      }

      // Use standardized timestamp utilities for updates
      const timestamps = addTimestamps({}, true);
      const syncMetadata = addSyncMetadata(existingLog, true);

      // Prepare update data with proper typing
      const updateData: Partial<LocalActivityLog> = {
        status,
        updated_at: timestamps.updated_at,
        _syncStatus: syncMetadata._syncStatus,
        _lastModified: syncMetadata._lastModified,
        _version: syncMetadata._version
      };

      if (completedAt) {
        updateData.completed_at = toISOString(completedAt); // Convert to ISO string
      }

      if (errorMessage) {
        updateData.error_message = errorMessage;
      }

      // Update local database
      await db.activityLogs.update(id, updateData);

      // Get updated record for sync
      const updatedLog = await db.activityLogs.get(id);
      if (updatedLog) {
        // Transform for sync queue (convert Date objects to ISO strings)
        const syncData = localToSupabase(updatedLog);
        await this.syncManager.addToSyncQueue('activityLogs', 'update', id, syncData);
      }
    } catch (error) {
      console.error('Error updating log status:', error);
      throw new Error(handleDatabaseError(error));
    }
  }

  /**
   * Get a single activity log by ID
   */
  async getLogById(id: string): Promise<ActivityLog | null> {
    try {
      const masterUserId = await this.getMasterUserId();

      // Try local first
      const localLog = await db.activityLogs.get(id);

      if (localLog && !localLog._deleted && localLog.master_user_id === masterUserId) {
        const transformed = this.transformLocalLogs([localLog]);
        return transformed[0] || null;
      }

      // Fallback to server
      const { data, error } = await supabase
        .from('history')
        .select(`
          *,
          groups (
            id,
            name,
            color
          ),
          templates (
            id,
            name
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
      const standardized = standardizeForService(data, 'history');
      return {
        id: standardized.id,
        user_id: standardized.user_id,
        master_user_id: standardized.master_user_id,
        contact_group_id: standardized.contact_group_id || undefined,
        template_id: standardized.template_id || undefined,
        template_name: standardized.template_name || undefined,
        total_contacts: standardized.total_contacts,
        success_count: standardized.success_count,
        failed_count: standardized.failed_count,
        status: standardized.status,
        delay_range: standardized.delay_range,
        scheduled_for: standardized.scheduled_for || undefined,
        started_at: standardized.started_at || undefined,
        completed_at: standardized.completed_at || undefined,
        error_message: standardized.error_message || undefined,
        metadata: standardized.metadata || undefined,
        created_at: standardized.created_at,
        updated_at: standardized.updated_at
      };
    } catch (error) {
      console.error('Error fetching log by ID:', error);
      throw new Error(handleDatabaseError(error));
    }
  }

  /**
   * Get activity logs with template and group information
   */
  async getLogsWithDetails(): Promise<ActivityLog[]> {
    try {
      const masterUserId = await this.getMasterUserId();

      // Try local first
      let localLogs = await db.activityLogs
        .where('master_user_id')
        .equals(masterUserId)
        .and(log => !log._deleted)
        .toArray();

      if (localLogs.length > 0) {
        return this.transformLocalLogs(localLogs);
      }

      // Fallback to server
      const serverLogs = await this.fetchLogsFromServer();
      return serverLogs;
    } catch (error) {
      console.error('Error fetching logs with details:', error);
      throw new Error(handleDatabaseError(error));
    }
  }

  /**
   * Set up real-time subscription for activity log updates
   */
  subscribeToActivityUpdates(
    callback: (activityLog: ActivityLog, eventType: 'INSERT' | 'UPDATE' | 'DELETE') => void
  ) {
    this.unsubscribeFromActivityUpdates();

    this.realtimeChannel = supabase
      .channel('history')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'history'
        },
        (payload) => {
          const { new: newRecord, old: oldRecord, eventType } = payload;

          // Transform the record to match ActivityLog interface with standardized timestamps
          const transformLog = (record: any): ActivityLog => {
            const standardized = standardizeForService(record, 'history');
            return {
              id: standardized.id,
              user_id: standardized.user_id,
              master_user_id: standardized.master_user_id,
              contact_group_id: standardized.contact_group_id || undefined,
              template_id: standardized.template_id || undefined,
              template_name: standardized.template_name || undefined,
              total_contacts: standardized.total_contacts,
              success_count: standardized.success_count,
              failed_count: standardized.failed_count,
              status: standardized.status,
              delay_range: standardized.delay_range,
              scheduled_for: standardized.scheduled_for || undefined,
              started_at: standardized.started_at || undefined,
              completed_at: standardized.completed_at || undefined,
              error_message: standardized.error_message || undefined,
              metadata: standardized.metadata || undefined,
              created_at: standardized.created_at,
              updated_at: standardized.updated_at
            };
          };

          if (eventType === 'DELETE') {
            callback(transformLog(oldRecord), 'DELETE');
          } else {
            callback(transformLog(newRecord), eventType as 'INSERT' | 'UPDATE');
          }
        }
      )
      .subscribe();
  }

  /**
   * Unsubscribe from activity updates
   */
  unsubscribeFromActivityUpdates() {
    if (this.realtimeChannel) {
      supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
  }

  /**
   * Get activity statistics
   */
  async getActivityStats() {
    try {
      const masterUserId = await this.getMasterUserId();

      // Try local first
      const localLogs = await db.activityLogs
        .where('master_user_id')
        .equals(masterUserId)
        .and(log => !log._deleted)
        .toArray();

      if (localLogs.length > 0) {
        const totalLogs = localLogs.length;
        const completedLogs = localLogs.filter(l => l.status === 'completed').length;
        const failedLogs = localLogs.filter(l => l.status === 'failed').length;
        const runningLogs = localLogs.filter(l => l.status === 'running').length;
        const pendingLogs = localLogs.filter(l => l.status === 'pending').length;

        const totalMessages = localLogs.reduce((sum, log) => sum + (log.total_contacts || 0), 0);
        const successfulMessages = localLogs.reduce((sum, log) => sum + (log.success_count || 0), 0);
        const failedMessages = localLogs.reduce((sum, log) => sum + (log.failed_count || 0), 0);

        return {
          totalLogs,
          completedLogs,
          failedLogs,
          runningLogs,
          pendingLogs,
          totalMessages,
          successfulMessages,
          failedMessages
        };
      }

      // Fallback to server
      const { data, error } = await supabase
        .from('history')
        .select('status, success_count, failed_count, total_contacts')
        .eq('master_user_id', masterUserId);

      if (error) throw error;

      const logs = data || [];
      const totalLogs = logs.length;
      const completedLogs = logs.filter(l => l.status === 'completed').length;
      const failedLogs = logs.filter(l => l.status === 'failed').length;
      const runningLogs = logs.filter(l => l.status === 'running').length;
      const pendingLogs = logs.filter(l => l.status === 'pending').length;

      const totalMessages = logs.reduce((sum, log) => sum + (log.total_contacts || 0), 0);
      const successfulMessages = logs.reduce((sum, log) => sum + (log.success_count || 0), 0);
      const failedMessages = logs.reduce((sum, log) => sum + (log.failed_count || 0), 0);

      return {
        totalLogs,
        completedLogs,
        failedLogs,
        runningLogs,
        pendingLogs,
        totalMessages,
        successfulMessages,
        failedMessages
      };
    } catch (error) {
      console.error('Error fetching activity stats:', error);
      throw new Error(handleDatabaseError(error));
    }
  }

  /**
   * Get recent activity logs (limited count)
   * Optimized for Dashboard display
   */
  async getRecentActivity(limit: number = 5): Promise<ActivityLog[]> {
    try {
      const masterUserId = await this.getMasterUserId();

      // Try local first - efficient query
      const localLogs = await db.activityLogs
        .where('master_user_id')
        .equals(masterUserId)
        .and(log => !log._deleted)
        .reverse() // Newest first
        .limit(limit)
        .toArray();

      if (localLogs.length > 0) {
        return this.transformLocalLogs(localLogs);
      }

      // Fallback to server if local is empty (e.g. fresh install before sync completes)
      // Check online status first
      const isOnline = await this.checkOnlineStatus();
      if (!isOnline) return [];

      const { data, error } = await supabase
        .from('history')
        .select(`
          *,
          groups (
            id,
            name,
            color
          ),
          templates (
            id,
            name
          )
        `)
        .eq('master_user_id', masterUserId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map(log => {
        const standardized = standardizeForService(log, 'history');
        return {
          id: standardized.id,
          user_id: standardized.user_id,
          master_user_id: standardized.master_user_id,
          contact_group_id: standardized.contact_group_id || undefined,
          template_id: standardized.template_id || undefined,
          template_name: standardized.template_name || undefined,
          total_contacts: standardized.total_contacts,
          success_count: standardized.success_count,
          failed_count: standardized.failed_count,
          status: standardized.status,
          delay_range: standardized.delay_range,
          scheduled_for: standardized.scheduled_for || undefined,
          started_at: standardized.started_at || undefined,
          completed_at: standardized.completed_at || undefined,
          error_message: standardized.error_message || undefined,
          metadata: standardized.metadata || undefined,
          created_at: standardized.created_at,
          updated_at: standardized.updated_at
        };
      });
    } catch (error) {
      console.error('Error fetching recent activity:', error);
      // Return empty array instead of throwing to prevent Dashboard crash
      return [];
    }
  }

  /**
   * Get all individual message logs from all campaigns
   * Flattens the metadata.logs from each activity log
   */
  async getAllMessageLogs(): Promise<MessageLog[]> {
    try {
      const activityLogs = await this.getActivityLogs();
      const messageLogs: MessageLog[] = [];

      for (const log of activityLogs) {
        if (log.metadata && Array.isArray(log.metadata.logs)) {
          const logs = log.metadata.logs as MessageLog[];
          messageLogs.push(...logs);
        }
      }

      // Sort by sent_at descending
      return messageLogs.sort((a, b) => {
        const dateA = a.sent_at ? new Date(a.sent_at).getTime() : 0;
        const dateB = b.sent_at ? new Date(b.sent_at).getTime() : 0;
        return dateB - dateA;
      });
    } catch (error) {
      console.error('Error fetching message logs:', error);
      // Return empty array on error to prevent UI crash
      return [];
    }
  }

  /**
   * Force sync with server
   */
  async forceSync(): Promise<void> {
    await this.syncManager.triggerSync();
  }

  /**
   * Get sync status for activity logs
   */
  async getSyncStatus() {
    const localLogs = await db.activityLogs
      .where('master_user_id')
      .equals(await this.getMasterUserId())
      .and(log => !log._deleted)
      .toArray();

    const pending = localLogs.filter(l => l._syncStatus === 'pending').length;
    const synced = localLogs.filter(l => l._syncStatus === 'synced').length;
    const conflicts = localLogs.filter(l => l._syncStatus === 'conflict').length;

    return {
      total: localLogs.length,
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
    this.unsubscribeFromActivityUpdates();
    this.syncManager.destroy();
  }
}
// QuotaService with real Supabase integration and standardized timestamps
import { supabase, rpcHelpers, handleDatabaseError } from '@/lib/supabase';
import { Quota, QuotaReservation, QuotaStatus } from './types';
import { db, LocalQuota, LocalQuotaReservation } from '@/lib/db';
import { SyncManager } from '../sync/SyncManager';
import { userContextManager } from '../security/UserContextManager';
import {
  toISOString,
  fromISOString,
  standardizeForService,
  nowISO
} from '../utils/timestamp';

export class QuotaService {
  private syncManager: SyncManager;


  constructor(syncManager?: SyncManager) {
    this.syncManager = syncManager || new SyncManager();
    this.setupSyncEventListeners();
  }

  /**
   * Setup event listeners for sync events
   */
  private setupSyncEventListeners() {
    this.syncManager.addEventListener((event) => {
      if (event.table === 'quotas' || event.table === 'quotaReservations') {
        switch (event.type) {
          case 'sync_complete':
            console.log('Quota sync completed');
            break;
          case 'sync_error':
            console.error('Quota sync error:', event.error);
            break;
          case 'conflict_detected':
            console.warn('Quota conflict detected:', event.message);
            break;
        }
      }
    });
  }

  /**
   * Set the current master user ID and configure sync
   */
  async initialize(masterUserId: string) {

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
   * Reserve quota - ALWAYS ONLINE (Supabase RPC)
   * Required by Architecture: "RPC = single source of truth untuk quota"
   */
  async reserveQuota(userId: string, messageCount: number) {
    // Check online
    const isOnline = this.syncManager.getIsOnline();
    if (!isOnline) {
      throw new Error('Internet connection required to reserve quota');
    }

    // Call Supabase RPC
    const result = await this.onlineReserveQuota(userId, messageCount);

    if (!result.success) {
      throw new Error(result.error_message || 'Failed to reserve quota');
    }

    // Cache reservation
    try {
      const masterUserId = await userContextManager.getCurrentMasterUserId();
      if (masterUserId) {
        await db.quotaReservations.add({
          id: result.reservation_id,
          user_id: userId,
          master_user_id: masterUserId,
          amount: messageCount,
          status: 'pending',
          created_at: nowISO(),
          updated_at: nowISO(),
          _syncStatus: 'synced',
          _lastModified: nowISO(),
          _version: 1
        });
      }
    } catch (e) {
      console.warn('Failed to cache reservation locally:', e);
      // Non-blocking, continue
    }

    return result;
  }

  /**
   * Commit quota - ONLINE FIRST, LOCAL FALLBACK
   * Architecture: "Commit → update quota + logs"
   */
  async commitQuota(reservationId: string, successCount: number) {
    if (successCount <= 0) {
      console.log('[QuotaService] successCount is 0, releasing reservation instead of committing.');
      await this.releaseQuota(reservationId);
      return;
    }
    try {
      // Try Supabase RPC first
      await this.onlineCommitQuota(reservationId, successCount);

      // Update local cache
      await db.quotaReservations.update(reservationId, {
        status: 'committed',
        committed_at: nowISO(),
        _syncStatus: 'synced',
        updated_at: nowISO()
      });

    } catch (error) {
      console.warn('[QuotaService] Online commit failed, using fallback');

      // Fallback to local
      await db.quotaReservations.update(reservationId, {
        status: 'committed',
        committed_at: nowISO(),
        _syncStatus: 'pending', // Will sync later
        updated_at: nowISO()
      });

      // Queue for sync
      await db.syncQueue.add({
        table: 'quotas',
        operation: 'update',
        recordId: reservationId,
        data: {
          action: 'commit_quota',
          reservation_id: reservationId,
          success_count: successCount
        },
        timestamp: nowISO(),
        retryCount: 0,
        status: 'pending'
      });
    }
  }

  /**
   * Get quota information for a user using RPC function
   * Enforces data isolation using UserContextManager
   * Enhanced with offline/online handling and better error recovery
   */
  async getQuota(userId: string): Promise<Quota> {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      // Check online status and prioritize accordingly
      const isOnline = this.syncManager.getIsOnline();

      if (isOnline) {
        try {
          // Use RPC function to check quota usage
          const quota = await rpcHelpers.checkQuotaUsage(userId);

          if (!quota) {
            throw new Error('No quota data found for user');
          }

          // Apply standardized timestamp handling to quota data
          const standardizedQuota = standardizeForService(quota, 'quota');
          return {
            ...standardizedQuota,
            id: quota.id,
            user_id: quota.user_id,
            master_user_id: quota.master_user_id,
            plan_type: quota.plan_type,
            messages_limit: quota.messages_limit,
            messages_used: quota.messages_used,
            remaining: quota.messages_limit - quota.messages_used,
            reset_date: quota.reset_date,
            is_active: quota.is_active
          };
        } catch (onlineError) {
          console.warn('Online quota fetch failed, trying local:', onlineError);

          // Try to get from local database
          const localQuota = await db.quotas.get(userId);
          if (localQuota) {
            // Return local data with standardized timestamps
            const standardizedQuota = standardizeForService(localQuota, 'quota');
            return {
              ...standardizedQuota,
              id: localQuota.id,
              user_id: localQuota.user_id,
              master_user_id: localQuota.master_user_id,
              plan_type: localQuota.plan_type,
              messages_limit: localQuota.messages_limit,
              messages_used: localQuota.messages_used,
              remaining: localQuota.messages_limit - localQuota.messages_used,
              reset_date: localQuota.reset_date,
              is_active: localQuota.is_active
            };
          }

          // If no local data, throw the original error
          throw new Error(`Failed to fetch quota: ${handleDatabaseError(onlineError)}`);
        }
      } else {
        // Offline mode: try to get from local database
        const localQuota = await db.quotas.get(userId);
        if (localQuota) {
          // Return local data with standardized timestamps
          const standardizedQuota = standardizeForService(localQuota, 'quota');
          return {
            ...standardizedQuota,
            id: localQuota.id,
            user_id: localQuota.user_id,
            master_user_id: localQuota.master_user_id,
            plan_type: localQuota.plan_type,
            messages_limit: localQuota.messages_limit,
            messages_used: localQuota.messages_used,
            remaining: localQuota.messages_limit - localQuota.messages_used,
            reset_date: localQuota.reset_date,
            is_active: localQuota.is_active
          };
        }

        // No local data available in offline mode
        throw new Error('No local quota data available and offline mode detected');
      }
    } catch (error) {
      console.error('Error fetching quota for user:', userId, error);

      // Enhanced error handling
      if (error instanceof Error) {
        throw new Error(`Failed to fetch quota: ${error.message}`);
      }
      throw new Error('Failed to fetch quota: Unknown error');
    }
  }

  /**
   * Subscribe to real-time quota updates using Supabase realtime
   */
  subscribeToQuotaUpdates(userId: string, callback: (quota: Quota) => void) {
    try {
      if (!userId) {
        throw new Error('User ID is required for subscription');
      }

      console.log('Subscribing to quota updates for user:', userId);

      const subscription = supabase
        .channel(`quota-${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_quotas',
            filter: `user_id=eq.${userId}`
          },
          async (payload: any) => {
            console.log('Real-time quota update received:', payload);

            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const updatedQuota = payload.new;

              try {
                // Apply standardized timestamp handling to real-time updates
                const standardizedQuota = standardizeForService(updatedQuota, 'quota');

                const quota: Quota = {
                  id: standardizedQuota.id,
                  user_id: standardizedQuota.user_id,
                  master_user_id: standardizedQuota.master_user_id,
                  plan_type: standardizedQuota.plan_type,
                  messages_limit: standardizedQuota.messages_limit,
                  messages_used: standardizedQuota.messages_used,
                  remaining: standardizedQuota.messages_limit - standardizedQuota.messages_used,
                  reset_date: standardizedQuota.reset_date,
                  is_active: standardizedQuota.is_active,
                  created_at: standardizedQuota.created_at,
                  updated_at: standardizedQuota.updated_at
                };

                callback(quota);
              } catch (error) {
                console.error('Error processing quota update:', error);
              }
            } else if (payload.eventType === 'DELETE') {
              // Handle quota deletion - refresh quota data
              try {
                const freshQuota = await this.getQuota(userId);
                callback(freshQuota);
              } catch (error) {
                console.error('Error refreshing quota after deletion:', error);
              }
            }
          }
        )
        .subscribe((status: string, err?: any) => {
          if (err) {
            console.error('Quota subscription error:', err);
          } else {
            console.log('Quota subscription status:', status);
          }
        });

      return {
        unsubscribe: () => {
          console.log('Unsubscribing from quota updates for user:', userId);
          subscription.unsubscribe();
        }
      };
    } catch (error) {
      console.error('Error setting up quota subscription:', error);
      throw new Error(`Failed to setup quota subscription: ${handleDatabaseError(error)}`);
    }
  }

  /**
   * Online quota reservation using RPC function
   */
  async onlineReserveQuota(userId: string, messageCount: number = 1): Promise<{
    success: boolean;
    reservation_id: string;
    error_message?: string;
  }> {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      if (messageCount <= 0) {
        throw new Error('Message count must be greater than 0');
      }

      console.log('Reserving quota for user:', userId, 'message count:', messageCount);

      // Use RPC function to reserve quota
      const result = await rpcHelpers.reserveQuota(userId, messageCount);

      if (!result.success) {
        return {
          success: false,
          reservation_id: '',
          error_message: result.error_message || 'Failed to reserve quota'
        };
      }

      return {
        success: true,
        reservation_id: result.reservation_id || `reserve_${Date.now()}`,
        error_message: undefined
      };
    } catch (error) {
      console.error('Error reserving quota for user:', userId, error);

      return {
        success: false,
        reservation_id: '',
        error_message: `Failed to reserve quota: ${handleDatabaseError(error)}`
      };
    }
  }

  /**
   * Online quota commit using RPC function
   */
  async onlineCommitQuota(reservationId: string, successCount: number = 1): Promise<void> {
    try {
      if (!reservationId) {
        throw new Error('Reservation ID is required');
      }

      if (successCount <= 0) {
        throw new Error('Success count must be greater than 0');
      }

      console.log('Committing quota usage:', { reservationId, successCount });

      // Use RPC function to commit quota usage
      const result = await rpcHelpers.commitQuotaUsage(reservationId, successCount);

      if (!result.success) {
        throw new Error(result.error_message || 'Failed to commit quota usage');
      }

      console.log('Quota committed successfully, remaining:', result.messages_remaining);
    } catch (error) {
      console.error('Error committing quota usage:', error);
      throw new Error(`Failed to commit quota: ${handleDatabaseError(error)}`);
    }
  }

  /**
   * Release quota reservation (for failed sends)
   */
  async releaseQuota(reservationId: string): Promise<void> {
    try {
      if (!reservationId) {
        throw new Error('Reservation ID is required');
      }

      console.log('Releasing quota reservation:', reservationId);

      // Update local reservation to cancelled so it doesn't block quota
      await db.quotaReservations.update(reservationId, {
        status: 'cancelled',
        updated_at: nowISO(),
        _syncStatus: 'pending'
      });

      console.log('Quota reservation released locally');
    } catch (error) {
      console.error('Error releasing quota reservation:', error);
      throw new Error(`Failed to release quota: ${handleDatabaseError(error)}`);
    }
  }
  /**
   * Get current user ID from auth session
   */
  async getCurrentUserId(): Promise<string> {
    try {
      const user = await userContextManager.getCurrentUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      return user.id;
    } catch (error) {
      console.error('Error getting current user ID:', error);
      throw new Error(`Authentication error: ${handleDatabaseError(error)}`);
    }
  }

  /**
   * Check if user has sufficient quota
   */
  async hasSufficientQuota(userId: string, requiredCount: number = 1): Promise<boolean> {
    try {
      if (!userId || requiredCount <= 0) {
        return false;
      }

      const quota = await this.getQuota(userId);
      return quota.remaining >= requiredCount;
    } catch (error) {
      console.error('Error checking sufficient quota:', error);
      return false;
    }
  }

  /**
   * Get quota usage statistics for dashboard with standardized timestamps
   */
  async getQuotaStats(userId: string): Promise<{
    usagePercentage: number;
    daysUntilReset: number;
    planType: string;
    canUpgrade: boolean;
  }> {
    try {
      const quota = await this.getQuota(userId);

      const usagePercentage = quota.messages_limit > 0
        ? Math.round((quota.messages_used / quota.messages_limit) * 100)
        : 0;

      // Use standardized timestamp handling for date calculations
      const now = new Date();
      const resetDate = fromISOString(quota.reset_date);
      const timeDifference = resetDate.getTime() - now.getTime();
      const daysUntilReset = Math.max(0, Math.ceil(timeDifference / (1000 * 3600 * 24)));

      const canUpgrade = quota.plan_type === 'basic' || usagePercentage > 80;

      return {
        usagePercentage,
        daysUntilReset,
        planType: quota.plan_type,
        canUpgrade
      };
    } catch (error) {
      console.error('Error getting quota stats:', error);
      return {
        usagePercentage: 0,
        daysUntilReset: 30,
        planType: 'basic',
        canUpgrade: true
      };
    }
  }

  /**
   * Create a new quota for a user (admin function)
   */
  async createQuota(userId: string, masterUserId: string, planType: string = 'basic', messagesLimit: number = 1000): Promise<Quota> {
    try {
      if (!userId || !masterUserId) {
        throw new Error('User ID and Master User ID are required');
      }

      if (!['basic', 'premium', 'enterprise'].includes(planType)) {
        throw new Error('Invalid plan type');
      }

      if (messagesLimit <= 0) {
        throw new Error('Messages limit must be greater than 0');
      }

      const { data, error } = await supabase
        .from('user_quotas')
        .insert({
          user_id: userId,
          master_user_id: masterUserId,
          plan_type: planType,
          messages_limit: messagesLimit,
          messages_used: 0,
          is_active: true
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Apply standardized timestamp handling
      const standardizedQuota = standardizeForService(data, 'quota');

      return {
        id: standardizedQuota.id,
        user_id: standardizedQuota.user_id,
        master_user_id: standardizedQuota.master_user_id,
        plan_type: standardizedQuota.plan_type,
        messages_limit: standardizedQuota.messages_limit,
        messages_used: standardizedQuota.messages_used,
        remaining: standardizedQuota.messages_limit - standardizedQuota.messages_used,
        reset_date: standardizedQuota.reset_date,
        is_active: standardizedQuota.is_active,
        created_at: standardizedQuota.created_at,
        updated_at: standardizedQuota.updated_at
      };
    } catch (error) {
      console.error('Error creating quota:', error);
      throw new Error(`Failed to create quota: ${handleDatabaseError(error)}`);
    }
  }

  /**
   * Update quota plan and limits with standardized timestamps
   */
  async updateQuota(quotaId: string, updates: {
    planType?: string;
    messagesLimit?: number;
    isActive?: boolean;
  }): Promise<Quota> {
    try {
      if (!quotaId) {
        throw new Error('Quota ID is required');
      }

      const updateData: any = {
        updated_at: toISOString(new Date())
      };

      if (updates.planType) {
        if (!['basic', 'premium', 'enterprise'].includes(updates.planType)) {
          throw new Error('Invalid plan type');
        }
        updateData.plan_type = updates.planType;
      }

      if (updates.messagesLimit !== undefined) {
        if (updates.messagesLimit <= 0) {
          throw new Error('Messages limit must be greater than 0');
        }
        updateData.messages_limit = updates.messagesLimit;
      }

      if (updates.isActive !== undefined) {
        updateData.is_active = updates.isActive;
      }

      const { data, error } = await supabase
        .from('user_quotas')
        .update(updateData)
        .eq('id', quotaId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Apply standardized timestamp handling
      const standardizedQuota = standardizeForService(data, 'quota');

      return {
        id: standardizedQuota.id,
        user_id: standardizedQuota.user_id,
        master_user_id: standardizedQuota.master_user_id,
        plan_type: standardizedQuota.plan_type,
        messages_limit: standardizedQuota.messages_limit,
        messages_used: standardizedQuota.messages_used,
        remaining: standardizedQuota.messages_limit - standardizedQuota.messages_used,
        reset_date: standardizedQuota.reset_date,
        is_active: standardizedQuota.is_active,
        created_at: standardizedQuota.created_at,
        updated_at: standardizedQuota.updated_at
      };
    } catch (error) {
      console.error('Error updating quota:', error);
      throw new Error(`Failed to update quota: ${handleDatabaseError(error)}`);
    }
  }

  // ============================================================================
  // LOCAL RPC EQUIVALENTS FOR OFFLINE QUOTA MANAGEMENT
  // ============================================================================


  /**
   * Local equivalent of reserve_quota RPC function
   * Creates a quota reservation in local IndexedDB
   */
  async localReserveQuota(userId: string, amount: number = 1): Promise<QuotaReservation> {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      if (amount <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      // First check if we have enough local quota
      const localQuota = await this.getLocalQuotaData(userId);
      if (!localQuota) {
        throw new Error('No local quota found for user');
      }

      // Check if we have enough quota including pending reservations
      const currentStatus = await this.getLocalQuotaStatus(userId);
      if (currentStatus.messages_remaining < amount) {
        throw new Error(`Insufficient quota. Remaining: ${currentStatus.messages_remaining}, Required: ${amount}`);
      }

      // Create reservation record
      const reservation: LocalQuotaReservation = {
        id: `local_reservation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: userId,
        master_user_id: localQuota.master_user_id,
        quota_id: localQuota.id,
        amount,
        status: 'pending',
        expires_at: nowISO(),
        created_at: nowISO(),
        updated_at: nowISO(),
        _syncStatus: 'pending',
        _lastModified: nowISO(),
        _version: 1,
        _deleted: false
      };

      await db.quotaReservations.add(reservation);

      // Return standardized reservation
      return {
        id: reservation.id,
        user_id: reservation.user_id,
        master_user_id: reservation.master_user_id,
        quota_id: reservation.quota_id,
        amount: reservation.amount,
        status: reservation.status,
        expires_at: reservation.expires_at,
        committed_at: reservation.committed_at,
        created_at: reservation.created_at,
        updated_at: reservation.updated_at
      };

    } catch (error) {
      console.error('Error in localReserveQuota:', error);
      throw new Error(`Failed to reserve local quota: ${handleDatabaseError(error)}`);
    }
  }

  /**
   * Local equivalent of commit_reservation RPC function
   * Commits a quota reservation and updates local quota usage
   */
  async localCommitReservation(reservationId: string): Promise<void> {
    try {
      if (!reservationId) {
        throw new Error('Reservation ID is required');
      }

      // Get the reservation
      const reservation = await db.quotaReservations.get(reservationId);
      if (!reservation) {
        throw new Error('Reservation not found');
      }

      if (reservation.status !== 'pending') {
        throw new Error(`Cannot commit reservation with status: ${reservation.status}`);
      }

      // Check if reservation has expired
      if (reservation.expires_at && fromISOString(reservation.expires_at) < new Date()) {
        throw new Error('Reservation has expired');
      }

      // Update reservation status to committed
      await db.quotaReservations.update(reservationId, {
        status: 'committed',
        committed_at: nowISO(),
        updated_at: nowISO(),
        _syncStatus: 'pending'
      });

      // Update local quota usage
      const quota = await this.getLocalQuotaData(reservation.user_id);
      if (quota) {
        await db.quotas.update(quota.id, {
          messages_used: quota.messages_used + reservation.amount,
          updated_at: toISOString(new Date()),
          _syncStatus: 'pending'
        });
      }

      console.log(`Local quota reservation ${reservationId} committed successfully`);
    } catch (error) {
      console.error('Error in localCommitReservation:', error);
      throw new Error(`Failed to commit local reservation: ${handleDatabaseError(error)}`);
    }
  }

  /**
   * Get current local quota status including active reservations
   */
  async getLocalQuotaStatus(userId?: string): Promise<QuotaStatus> {
    try {
      const currentUserId = userId || await this.getCurrentUserId();

      const quota = await this.getLocalQuotaData(currentUserId);
      if (!quota) {
        throw new Error('No local quota found for user');
      }

      // Get active reservations (pending and not expired)
      const activeReservations = await db.quotaReservations
        .where('user_id')
        .equals(currentUserId)
        .and(r => r.status === 'pending' && (!r.expires_at || fromISOString(r.expires_at) > new Date()))
        .toArray();

      const reservedAmount = activeReservations.reduce((sum, r) => sum + r.amount, 0);
      const messagesRemaining = Math.max(0, quota.messages_limit - quota.messages_used - reservedAmount);

      return {
        user_id: currentUserId,
        master_user_id: quota.master_user_id,
        messages_remaining: messagesRemaining,
        plan_type: quota.plan_type,
        reset_date: quota.reset_date,
        active_reservations: activeReservations.length,
        reserved_amount: reservedAmount
      };
    } catch (error) {
      console.error('Error getting local quota status:', error);
      throw new Error(`Failed to get local quota status: ${handleDatabaseError(error)}`);
    }
  }

  /**
   * Get local quota data for a user
   */
  private async getLocalQuotaData(userId: string): Promise<LocalQuota | undefined> {
    try {
      return await db.quotas
        .where('user_id')
        .equals(userId)
        .and(q => q.is_active)
        .first();
    } catch (error) {
      console.error('Error getting local quota data:', error);
      return undefined;
    }
  }

  /**
   * Validate if a quota request can be fulfilled locally
   */
  async validateQuotaRequest(amount: number, userId?: string): Promise<boolean> {
    try {
      if (amount <= 0) return false;

      const currentUserId = userId || await this.getCurrentUserId();
      const status = await this.getLocalQuotaStatus(currentUserId);

      return status.messages_remaining >= amount;
    } catch (error) {
      console.error('Error validating quota request:', error);
      return false;
    }
  }

  /**
   * Get user's reservation history from local storage
   */
  async getReservationHistory(userId?: string): Promise<QuotaReservation[]> {
    try {
      const currentUserId = userId || await this.getCurrentUserId();

      const reservations = await db.quotaReservations
        .where('user_id')
        .equals(currentUserId)
        .reverse()
        .sortBy('created_at');

      return reservations.map(reservation => ({
        id: reservation.id,
        user_id: reservation.user_id,
        master_user_id: reservation.master_user_id,
        quota_id: reservation.quota_id,
        amount: reservation.amount,
        status: reservation.status,
        expires_at: reservation.expires_at,
        committed_at: reservation.committed_at,
        created_at: reservation.created_at,
        updated_at: reservation.updated_at
      }));
    } catch (error) {
      console.error('Error getting reservation history:', error);
      return [];
    }
  }

  /**
   * Cancel a pending quota reservation
   */
  async cancelReservation(reservationId: string): Promise<void> {
    try {
      if (!reservationId) {
        throw new Error('Reservation ID is required');
      }

      const reservation = await db.quotaReservations.get(reservationId);
      if (!reservation) {
        throw new Error('Reservation not found');
      }

      if (reservation.status !== 'pending') {
        throw new Error(`Cannot cancel reservation with status: ${reservation.status}`);
      }

      await db.quotaReservations.update(reservationId, {
        status: 'cancelled',
        updated_at: nowISO(),
        _syncStatus: 'pending'
      });

      console.log(`Local quota reservation ${reservationId} cancelled successfully`);
    } catch (error) {
      console.error('Error cancelling reservation:', error);
      throw new Error(`Failed to cancel reservation: ${handleDatabaseError(error)}`);
    }
  }

  /**
   * Local equivalent of cancel_quota_reservation RPC function
   * Cancels a quota reservation in local IndexedDB
   */
  async localCancelReservation(reservationId: string): Promise<void> {
    try {
      if (!reservationId) {
        throw new Error('Reservation ID is required');
      }

      const reservation = await db.quotaReservations.get(reservationId);
      if (!reservation) {
        throw new Error('Reservation not found');
      }

      if (reservation.status !== 'pending') {
        throw new Error(`Cannot cancel reservation with status: ${reservation.status}`);
      }

      await db.quotaReservations.update(reservationId, {
        status: 'cancelled',
        updated_at: nowISO(),
        _syncStatus: 'pending'
      });

      console.log(`Local quota reservation ${reservationId} cancelled successfully`);
    } catch (error) {
      console.error('Error in localCancelReservation:', error);
      throw new Error(`Failed to cancel local reservation: ${handleDatabaseError(error)}`);
    }
  }

  /**
   * Clean up expired reservations
   */
  async cleanupExpiredReservations(): Promise<void> {
    try {
      const now = nowISO();
      await db.quotaReservations
        .where('status')
        .equals('pending')
        .and(r => r.expires_at !== undefined && fromISOString(r.expires_at) < new Date())
        .modify({
          status: 'expired',
          updated_at: now,
          _syncStatus: 'pending'
        });
    } catch (error) {
      console.error('Error cleaning up expired reservations:', error);
    }
  }





  /**
   * Cancel reservation with the new interface
   */
}

// Create a singleton instance
export const quotaService = new QuotaService();
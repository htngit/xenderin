// LocalQuotaService - Offline equivalents of Supabase RPC functions for quota management
// Enhanced with online/offline handling and fallback capabilities
import { db, LocalQuota, LocalQuotaReservation } from '@/lib/db';
import { QuotaReservation, QuotaStatus } from './types';
import { userContextManager } from '../security/UserContextManager';
import { toISOString, nowISO, fromISOString } from '../utils/timestamp';

export class LocalQuotaService {
  /**
   * Local equivalent of check_quota_usage RPC function
   * Returns current quota usage information for offline operations
   */
  async checkQuotaUsage(userId: string): Promise<{
    quota_id: string;
    messages_remaining: number;
    plan_type: string;
    reset_date: string;
    master_user_id: string;
  }> {
    try {
      // Enforce data isolation - check user context and permissions
      const hasPermission = await userContextManager.canPerformAction('read_quotas', 'quotas');
      if (!hasPermission) {
        throw new Error('Access denied: insufficient permissions to read quotas');
      }

      if (!userId) {
        throw new Error('User ID is required');
      }

      // Get local quota data
      const localQuota = await this.getLocalQuotaData(userId);
      if (!localQuota) {
        throw new Error('No local quota data found for user');
      }

      // Get active reservations to calculate remaining quota
      const activeReservations = await db.quotaReservations
        .where('user_id')
        .equals(userId)
        .and(r => r.status === 'pending' && (!r.expires_at || fromISOString(r.expires_at) > new Date()))
        .toArray();

      const reservedAmount = activeReservations.reduce((sum, r) => sum + r.amount, 0);
      const messagesRemaining = Math.max(0, localQuota.messages_limit - localQuota.messages_used - reservedAmount);

      return {
        quota_id: localQuota.id,
        messages_remaining: messagesRemaining,
        plan_type: localQuota.plan_type,
        reset_date: localQuota.reset_date,
        master_user_id: localQuota.master_user_id
      };
    } catch (error) {
      console.error('Error in local checkQuotaUsage:', error);
      throw new Error(`Failed to check local quota usage: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Local equivalent of reserve_quota RPC function
   * Reserves quota for upcoming operations in local database
   */
  async reserveQuota(userId: string, messagesCount: number = 1): Promise<{
    success: boolean;
    quota_id: string;
    messages_remaining: number;
    error_message?: string;
  }> {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      if (messagesCount <= 0) {
        throw new Error('Messages count must be greater than 0');
      }

      console.log('Reserving local quota for user:', userId, 'count:', messagesCount);

      // Get local quota data
      const localQuota = await this.getLocalQuotaData(userId);
      if (!localQuota) {
        return {
          success: false,
          quota_id: '',
          messages_remaining: 0,
          error_message: 'No local quota data found for user'
        };
      }

      // Check if we have enough quota including pending reservations
      const activeReservations = await db.quotaReservations
        .where('user_id')
        .equals(userId)
        .and(r => r.status === 'pending' && (!r.expires_at || fromISOString(r.expires_at) > new Date()))
        .toArray();

      const reservedAmount = activeReservations.reduce((sum, r) => sum + r.amount, 0);
      const availableQuota = localQuota.messages_limit - localQuota.messages_used - reservedAmount;

      if (availableQuota < messagesCount) {
        return {
          success: false,
          quota_id: localQuota.id,
          messages_remaining: availableQuota,
          error_message: `Insufficient quota. Available: ${availableQuota}, Required: ${messagesCount}`
        };
      }

      // Create reservation record
      const reservation: LocalQuotaReservation = {
        id: `local_reservation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: userId,
        master_user_id: localQuota.master_user_id,
        quota_id: localQuota.id,
        amount: messagesCount,
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

      const remainingAfterReservation = availableQuota - messagesCount;

      console.log('Local quota reserved successfully:', reservation.id);

      return {
        success: true,
        quota_id: localQuota.id,
        messages_remaining: remainingAfterReservation,
        error_message: undefined
      };
    } catch (error) {
      console.error('Error in local reserveQuota:', error);
      return {
        success: false,
        quota_id: '',
        messages_remaining: 0,
        error_message: `Failed to reserve local quota: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Local equivalent of commit_quota_usage RPC function
   * Commits reserved quota usage and updates local quota counters
   */
  async commitQuotaUsage(quotaId: string, messagesUsed: number = 1): Promise<{
    success: boolean;
    messages_remaining: number;
    error_message?: string;
  }> {
    try {
      if (!quotaId) {
        throw new Error('Quota ID is required');
      }

      if (messagesUsed <= 0) {
        throw new Error('Messages used must be greater than 0');
      }

      console.log('Committing local quota usage:', { quotaId, messagesUsed });

      // Get the quota data
      const quota = await db.quotas.get(quotaId);
      if (!quota) {
        return {
          success: false,
          messages_remaining: 0,
          error_message: 'Quota not found'
        };
      }

      // Find a pending reservation for this quota
      const reservation = await db.quotaReservations
        .where('quota_id')
        .equals(quotaId)
        .and(r => r.status === 'pending')
        .first();

      if (!reservation) {
        return {
          success: false,
          messages_remaining: quota.messages_limit - quota.messages_used,
          error_message: 'No pending reservation found for this quota'
        };
      }

      // Check if reservation has expired
      if (reservation.expires_at && fromISOString(reservation.expires_at) < new Date()) {
        // Mark reservation as expired
        await db.quotaReservations.update(reservation.id, {
          status: 'expired',
          updated_at: nowISO(),
          _syncStatus: 'pending'
        });

        return {
          success: false,
          messages_remaining: quota.messages_limit - quota.messages_used,
          error_message: 'Reservation has expired'
        };
      }

      // Validate that we're not committing more than reserved
      if (messagesUsed > reservation.amount) {
        return {
          success: false,
          messages_remaining: quota.messages_limit - quota.messages_used,
          error_message: `Cannot commit more messages (${messagesUsed}) than reserved (${reservation.amount})`
        };
      }

      // Update reservation status to committed
      await db.quotaReservations.update(reservation.id, {
        status: 'committed',
        committed_at: nowISO(),
        updated_at: nowISO(),
        _syncStatus: 'pending'
      });

      // Update local quota usage
      const newMessagesUsed = quota.messages_used + messagesUsed;
      await db.quotas.update(quotaId, {
        messages_used: newMessagesUsed,
        updated_at: toISOString(new Date()),
        _syncStatus: 'pending'
      });

      const messagesRemaining = quota.messages_limit - newMessagesUsed;

      console.log('Local quota committed successfully, remaining:', messagesRemaining);

      return {
        success: true,
        messages_remaining: messagesRemaining,
        error_message: undefined
      };
    } catch (error) {
      console.error('Error in local commitQuotaUsage:', error);
      return {
        success: false,
        messages_remaining: 0,
        error_message: `Failed to commit local quota usage: ${error instanceof Error ? error.message : String(error)}`
      };
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
      throw new Error(`Failed to get local quota status: ${error instanceof Error ? error.message : String(error)}`);
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
   * Get current user ID from auth context
   */
  private async getCurrentUserId(): Promise<string> {
    try {
      const user = await userContextManager.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }
      return user.id;
    } catch (error) {
      console.error('Error getting current user ID:', error);
      throw new Error('Authentication required for quota operations');
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
      throw new Error(`Failed to cancel reservation: ${error instanceof Error ? error.message : String(error)}`);
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

      console.log('Expired reservations cleaned up');
    } catch (error) {
      console.error('Error cleaning up expired reservations:', error);
    }
  }

  /**
   * Create or update local quota data (for sync purposes)
   */
  async syncQuotaData(quotaData: Partial<LocalQuota>): Promise<void> {
    try {
      if (!quotaData.id || !quotaData.user_id) {
        throw new Error('Quota ID and User ID are required for sync');
      }

      const existingQuota = await db.quotas.get(quotaData.id);

      if (existingQuota) {
        // Update existing quota
        await db.quotas.update(quotaData.id, {
          ...quotaData,
          _syncStatus: 'synced',
          _lastModified: nowISO(),
          _version: (existingQuota._version || 0) + 1
        });
      } else {
        // Create new quota
        const newQuota: LocalQuota = {
          ...quotaData,
          _syncStatus: 'synced',
          _lastModified: nowISO(),
          _version: 1
        } as LocalQuota;

        await db.quotas.add(newQuota);
      }

      console.log('Local quota data synced successfully');
    } catch (error) {
      console.error('Error syncing quota data:', error);
      throw new Error(`Failed to sync quota data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
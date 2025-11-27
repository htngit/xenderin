import { QuotaService } from '../QuotaService';
import { db } from '@/lib/db';
import { userContextManager } from '../../security/UserContextManager';
import { supabase, rpcHelpers } from '@/lib/supabase';
import { ReservationResult, CommitResult } from '../types';

// Mock the database
jest.mock('@/lib/db', () => ({
  db: {
    quotas: {
      get: jest.fn(),
      where: jest.fn(() => ({
        equals: jest.fn(() => ({
          and: jest.fn(() => ({
            first: jest.fn()
          }))
        }))
      })),
      update: jest.fn(),
      add: jest.fn()
    },
    quotaReservations: {
      get: jest.fn(),
      add: jest.fn(),
      update: jest.fn(),
      where: jest.fn(() => ({
        equals: jest.fn(() => ({
          and: jest.fn(() => ({
            toArray: jest.fn(),
            modify: jest.fn()
          }))
        }))
      }))
    }
  }
}));

// Mock user context manager
jest.mock('../../security/UserContextManager', () => ({
  userContextManager: {
    getCurrentUser: jest.fn()
  }
}));

// Mock Supabase and RPC helpers
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn()
        }))
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn()
          }))
        }))
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn()
        }))
      }))
    })),
    channel: jest.fn(() => ({
      on: jest.fn(() => ({
        subscribe: jest.fn((callback) => {
          if (typeof callback === 'function') {
            callback('SUBSCRIBED');
          }
          return { unsubscribe: jest.fn() };
        })
      }))
    }))
  },
  rpcHelpers: {
    reserveQuota: jest.fn(),
    commitQuotaUsage: jest.fn(),
    cancelQuotaReservation: jest.fn(),
    checkQuotaUsage: jest.fn()
  },
  handleDatabaseError: jest.fn((error) => error.message || 'Database error')
}));

// Mock fetch for network checking
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({})
  } as Response)
) as jest.Mock;

describe('QuotaService Integration Tests', () => {
  let quotaService: QuotaService;
  const mockUserId = 'test-user-id';
  const mockMasterUserId = 'test-master-user-id';

  beforeEach(() => {
    quotaService = new QuotaService();
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup default user context
    (userContextManager.getCurrentUser as jest.Mock).mockResolvedValue({
      id: mockUserId,
      email: 'test@example.com',
      name: 'Test User',
      role: 'owner',
      master_user_id: mockMasterUserId
    });
  });

  describe('reserveQuota', () => {
    it('should successfully reserve quota when online', async () => {
      // Mock successful reservation via RPC
      const mockReservation = {
        success: true,
        reservation_id: 'reservation-123',
        error_message: undefined
      };
      (rpcHelpers.reserveQuota as jest.Mock).mockResolvedValue(mockReservation);
      
      // Mock quota data
      const mockQuota = {
        id: 'quota-1',
        user_id: mockUserId,
        master_user_id: mockMasterUserId,
        messages_limit: 1000,
        messages_used: 100,
        remaining: 900,
        plan_type: 'basic',
        reset_date: '2024-12-01',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      (db.quotas.get as jest.Mock).mockResolvedValue(mockQuota);
      (rpcHelpers.checkQuotaUsage as jest.Mock).mockResolvedValue(mockQuota);

      const result: ReservationResult = await (quotaService as any).reserveQuota(5);

      expect(result.success).toBe(true);
      expect(result.reservationId).toBe('reservation-123');
      expect(result.messagesRemaining).toBe(900);
      expect(rpcHelpers.reserveQuota).toHaveBeenCalledWith(mockUserId, 5);
    });

    it('should handle reservation failure gracefully', async () => {
      // Mock failed reservation via RPC
      const mockReservation = {
        success: false,
        reservation_id: '',
        error_message: 'Insufficient quota'
      };
      (rpcHelpers.reserveQuota as jest.Mock).mockResolvedValue(mockReservation);

      const result: ReservationResult = await (quotaService as any).reserveQuota(5);

      expect(result.success).toBe(false);
      expect(result.reservationId).toBe('');
      expect(result.messagesRemaining).toBe(0);
      expect(result.errorMessage).toBe('Insufficient quota');
    });

    it('should fall back to local reservation when online fails', async () => {
      // Mock online failure
      (rpcHelpers.reserveQuota as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      // Mock local quota data
      const mockLocalQuota = {
        id: 'quota-1',
        user_id: mockUserId,
        master_user_id: mockMasterUserId,
        messages_limit: 1000,
        messages_used: 100,
        remaining: 900,
        plan_type: 'basic',
        reset_date: '2024-12-01',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      (db.quotas.get as jest.Mock).mockResolvedValue(mockLocalQuota);

      // Mock local reservation creation
      const mockLocalReservation = {
        id: 'local_reservation_123',
        user_id: mockUserId,
        master_user_id: mockMasterUserId,
        quota_id: 'quota-1',
        amount: 5,
        status: 'pending',
        expires_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      (db.quotaReservations.add as jest.Mock).mockResolvedValue('local_reservation_123');
      (db.quotaReservations.get as jest.Mock).mockResolvedValue(mockLocalReservation);

      // Mock local quota status
      const mockLocalStatus = {
        user_id: mockUserId,
        master_user_id: mockMasterUserId,
        messages_remaining: 895, // 900 - 5
        plan_type: 'basic',
        reset_date: '2024-12-01',
        active_reservations: 1,
        reserved_amount: 5
      };
      (quotaService as any).getLocalQuotaStatus = jest.fn().mockResolvedValue(mockLocalStatus);

      const result: ReservationResult = await (quotaService as any).reserveQuota(5);

      expect(result.success).toBe(true);
      expect(result.reservationId).toBe('local_reservation_123');
      expect(result.messagesRemaining).toBe(895);
      expect(result.errorMessage).toContain('offline mode');
    });
  });

  describe('commitReservation', () => {
    it('should successfully commit a reservation when online', async () => {
      const reservationId = 'reservation-123';
      const actualUsed = 5;
      
      // Mock successful commit via RPC
      const mockCommitResult = {
        success: true,
        messages_remaining: 895,
        error_message: undefined
      };
      (rpcHelpers.commitQuotaUsage as jest.Mock).mockResolvedValue(mockCommitResult);
      
      // Mock quota data
      const mockQuota = {
        id: 'quota-1',
        user_id: mockUserId,
        master_user_id: mockMasterUserId,
        messages_limit: 1000,
        messages_used: 105,
        remaining: 895,
        plan_type: 'basic',
        reset_date: '2024-12-01',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      (db.quotas.get as jest.Mock).mockResolvedValue(mockQuota);
      (rpcHelpers.checkQuotaUsage as jest.Mock).mockResolvedValue(mockQuota);

      const result: CommitResult = await (quotaService as any).commitReservation(reservationId, actualUsed);

      expect(result.success).toBe(true);
      expect(result.messagesUsed).toBe(actualUsed);
      expect(result.messagesRemaining).toBe(895);
      expect(rpcHelpers.commitQuotaUsage).toHaveBeenCalledWith(reservationId, actualUsed);
    });

    it('should handle commit failure gracefully', async () => {
      const reservationId = 'reservation-123';
      const actualUsed = 5;
      
      // Mock failed commit via RPC
      (rpcHelpers.commitQuotaUsage as jest.Mock).mockRejectedValue(new Error('Reservation not found'));

      const result: CommitResult = await (quotaService as any).commitReservation(reservationId, actualUsed);

      expect(result.success).toBe(false);
      expect(result.messagesUsed).toBe(0);
      expect(result.messagesRemaining).toBe(0);
    });

    it('should handle local reservation commit when reservation starts with "local_reservation_"', async () => {
      const reservationId = 'local_reservation_123';
      const actualUsed = 5;
      
      // Mock successful local commit
      (quotaService as any).localCommitReservation = jest.fn().mockResolvedValue(undefined);
      
      // Mock local quota status after commit
      const mockLocalStatus = {
        user_id: mockUserId,
        master_user_id: mockMasterUserId,
        messages_remaining: 890,
        plan_type: 'basic',
        reset_date: '2024-12-01',
        active_reservations: 0,
        reserved_amount: 0
      };
      (quotaService as any).getLocalQuotaStatus = jest.fn().mockResolvedValue(mockLocalStatus);
      
      const result: CommitResult = await (quotaService as any).commitReservation(reservationId, actualUsed);

      expect(result.success).toBe(true);
      expect(result.messagesUsed).toBe(actualUsed);
      expect(result.messagesRemaining).toBe(890);
      expect((quotaService as any).localCommitReservation).toHaveBeenCalledWith(reservationId);
    });
  });

  describe('cancelReservation', () => {
    it('should successfully cancel a reservation when online', async () => {
      const reservationId = 'reservation-123';
      
      // Mock successful cancellation via RPC
      const mockCancelResult = {
        success: true,
        error_message: undefined
      };
      (rpcHelpers.cancelQuotaReservation as jest.Mock).mockResolvedValue(mockCancelResult);
      
      // Mock quota data
      const mockQuota = {
        id: 'quota-1',
        user_id: mockUserId,
        master_user_id: mockMasterUserId,
        messages_limit: 1000,
        messages_used: 100,
        remaining: 900,
        plan_type: 'basic',
        reset_date: '2024-12-01',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      (db.quotas.get as jest.Mock).mockResolvedValue(mockQuota);
      (rpcHelpers.checkQuotaUsage as jest.Mock).mockResolvedValue(mockQuota);

      const result: ReservationResult = await (quotaService as any).cancelReservation(reservationId);

      expect(result.success).toBe(true);
      expect(result.reservationId).toBe(reservationId);
      expect(rpcHelpers.cancelQuotaReservation).toHaveBeenCalledWith(reservationId);
    });

    it('should handle cancellation failure gracefully', async () => {
      const reservationId = 'reservation-123';
      
      // Mock failed cancellation via RPC
      (rpcHelpers.cancelQuotaReservation as jest.Mock).mockRejectedValue(new Error('Reservation not found'));

      const result: ReservationResult = await (quotaService as any).cancelReservation(reservationId);

      expect(result.success).toBe(false);
      expect(result.reservationId).toBe('');
      expect(result.messagesRemaining).toBe(0);
      expect(result.errorMessage).toContain('Failed to cancel reservation');
    });

    it('should handle local reservation cancellation when reservation starts with "local_reservation_"', async () => {
      const reservationId = 'local_reservation_123';
      
      // Mock local reservation data
      const mockReservation = {
        id: reservationId,
        user_id: mockUserId,
        master_user_id: mockMasterUserId,
        quota_id: 'quota-1',
        amount: 5,
        status: 'pending',
        expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      (db.quotaReservations.get as jest.Mock).mockResolvedValue(mockReservation);
      (db.quotaReservations.update as jest.Mock).mockResolvedValue(undefined);
      
      // Mock local quota status after cancellation
      const mockLocalStatus = {
        user_id: mockUserId,
        master_user_id: mockMasterUserId,
        messages_remaining: 905, // Should have 5 more available after cancellation
        plan_type: 'basic',
        reset_date: '2024-12-01',
        active_reservations: 0,
        reserved_amount: 0
      };
      (quotaService as any).getLocalQuotaStatus = jest.fn().mockResolvedValue(mockLocalStatus);
      
      const result: ReservationResult = await (quotaService as any).cancelReservation(reservationId);

      expect(result.success).toBe(true);
      expect(result.reservationId).toBe(reservationId);
      expect(result.messagesRemaining).toBe(905);
      expect(db.quotaReservations.update).toHaveBeenCalledWith(reservationId, expect.objectContaining({
        status: 'cancelled'
      }));
    });
  });

  describe('Integration Flow: Reserve -> Commit', () => {
    it('should handle full reservation commit flow', async () => {
      // Mock reservation
      const mockReservation = {
        success: true,
        reservation_id: 'reservation-456',
        error_message: undefined
      };
      (rpcHelpers.reserveQuota as jest.Mock).mockResolvedValue(mockReservation);
      
      // Mock quota data
      const mockQuota = {
        id: 'quota-1',
        user_id: mockUserId,
        master_user_id: mockMasterUserId,
        messages_limit: 1000,
        messages_used: 100,
        remaining: 900,
        plan_type: 'basic',
        reset_date: '2024-12-01',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      (db.quotas.get as jest.Mock).mockResolvedValue(mockQuota);
      (rpcHelpers.checkQuotaUsage as jest.Mock).mockResolvedValue(mockQuota);

      // Perform reservation
      const reservationResult: ReservationResult = await (quotaService as any).reserveQuota(10);
      expect(reservationResult.success).toBe(true);
      expect(reservationResult.reservationId).toBe('reservation-456');

      // Mock commit response
      const mockCommitResult = {
        success: true,
        messages_remaining: 890, // 900 - 10
        error_message: undefined
      };
      (rpcHelpers.commitQuotaUsage as jest.Mock).mockResolvedValue(mockCommitResult);

      // Perform commit
      const commitResult: CommitResult = await (quotaService as any).commitReservation('reservation-456', 10);
      expect(commitResult.success).toBe(true);
      expect(commitResult.messagesUsed).toBe(10);
      expect(commitResult.messagesRemaining).toBe(890);
    });

    it('should handle reservation commit flow with partial success', async () => {
      // Mock reservation
      const mockReservation = {
        success: true,
        reservation_id: 'reservation-789',
        error_message: undefined
      };
      (rpcHelpers.reserveQuota as jest.Mock).mockResolvedValue(mockReservation);
      
      // Mock quota data
      const mockQuota = {
        id: 'quota-1',
        user_id: mockUserId,
        master_user_id: mockMasterUserId,
        messages_limit: 1000,
        messages_used: 100,
        remaining: 900,
        plan_type: 'basic',
        reset_date: '2024-12-01',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      (db.quotas.get as jest.Mock).mockResolvedValue(mockQuota);
      (rpcHelpers.checkQuotaUsage as jest.Mock).mockResolvedValue(mockQuota);

      // Perform reservation
      const reservationResult: ReservationResult = await (quotaService as any).reserveQuota(20);
      expect(reservationResult.success).toBe(true);
      expect(reservationResult.reservationId).toBe('reservation-789');

      // Mock commit with less success than reserved (simulating partial success)
      const mockCommitResult = {
        success: true,
        messages_remaining: 885, // 900 - 15 (not the full 20)
        error_message: undefined
      };
      (rpcHelpers.commitQuotaUsage as jest.Mock).mockResolvedValue(mockCommitResult);

      // Perform commit with actual used count
      const commitResult: CommitResult = await (quotaService as any).commitReservation('reservation-789', 15);
      expect(commitResult.success).toBe(true);
      expect(commitResult.messagesUsed).toBe(15);  // Only 15 messages actually used
      expect(commitResult.messagesRemaining).toBe(885);
    });
  });

  describe('Integration Flow: Reserve -> Cancel', () => {
    it('should handle reservation cancellation flow', async () => {
      // Mock reservation
      const mockReservation = {
        success: true,
        reservation_id: 'reservation-cancel-1',
        error_message: undefined
      };
      (rpcHelpers.reserveQuota as jest.Mock).mockResolvedValue(mockReservation);
      
      // Mock quota data
      const mockQuota = {
        id: 'quota-1',
        user_id: mockUserId,
        master_user_id: mockMasterUserId,
        messages_limit: 1000,
        messages_used: 100,
        remaining: 900,
        plan_type: 'basic',
        reset_date: '2024-12-01',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      (db.quotas.get as jest.Mock).mockResolvedValue(mockQuota);
      (rpcHelpers.checkQuotaUsage as jest.Mock).mockResolvedValue(mockQuota);

      // Perform reservation
      const reservationResult: ReservationResult = await (quotaService as any).reserveQuota(15);
      expect(reservationResult.success).toBe(true);
      expect(reservationResult.reservationId).toBe('reservation-cancel-1');
      expect(reservationResult.messagesRemaining).toBe(885);  // 900 - 15

      // Mock cancellation response
      const mockCancelResult = {
        success: true,
        error_message: undefined
      };
      (rpcHelpers.cancelQuotaReservation as jest.Mock).mockResolvedValue(mockCancelResult);

      // Perform cancellation
      const cancelResult: ReservationResult = await (quotaService as any).cancelReservation('reservation-cancel-1');
      expect(cancelResult.success).toBe(true);
      expect(cancelResult.reservationId).toBe('reservation-cancel-1');
      // After cancellation, the reserved amount should be released, so messagesRemaining should be back to 900
      expect(cancelResult.messagesRemaining).toBe(900);
    });
  });
});
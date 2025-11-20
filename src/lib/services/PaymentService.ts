import { supabase } from '../supabase';
import { SubscriptionPlan, PaymentSession } from './types';
import { userContextManager } from '../security/UserContextManager';

/**
 * Enhanced PaymentService for DUITKU Payment Gateway Integration
 * Uses Supabase Edge Functions for secure payment processing
 * Enhanced with offline/online handling and better error recovery
 * Fixed authentication integration with UserContextManager
 */
export class PaymentService {
  private supabase: typeof supabase;

  constructor() {
    this.supabase = supabase;
  }

  private async checkOnlineStatus(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      // Try multiple endpoints for better reliability
      const endpoints = [
        '/api/ping',
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/`,
        '/health'
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            method: 'HEAD',
            cache: 'no-cache',
            signal: controller.signal
          });

          clearTimeout(timeoutId);
          if (response.ok) return true;
        } catch (e) {
          continue;
        }
      }

      return false;
    } catch (error) {
      console.log('Network check failed, assuming offline mode:', error);
      return false;
    }
  }

  /**
   * Create a new payment using Edge Functions integration
   * @param planType - The subscription plan to upgrade to
   * @param amount - Payment amount in IDR (cents)
   * @param userId - User ID for the payment
   * @returns Promise with payment session details including QR code
   */
  async createPayment(
    planType: SubscriptionPlan,
    amount: number,
    userId: string
  ): Promise<PaymentSession> {
    try {
      console.log('Creating payment for:', { planType, amount, userId });

      // Check online status
      const isOnline = await this.checkOnlineStatus();

      if (!isOnline) {
        throw new Error('Payment creation requires an active internet connection');
      }

      // Create payment via Supabase Edge Function
      const { data: paymentData, error: paymentError } = await this.supabase.functions.invoke(
        'create-payment',
        {
          body: {
            plan_type: planType,
            amount: amount,
            user_id: userId
          }
        }
      );

      if (paymentError) {
        console.error('Payment creation error:', paymentError);
        throw new Error(`Failed to create payment: ${paymentError.message}`);
      }

      if (!paymentData?.success) {
        throw new Error('Payment creation failed - invalid response from payment service');
      }

      // Return structured payment session
      return {
        paymentId: paymentData.payment_id,
        duitkuTransactionId: paymentData.transaction_id,
        qrUrl: paymentData.qr_url,
        amount: amount,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
        status: 'pending'
      };

    } catch (error) {
      console.error('Payment creation error:', error);

      if (error instanceof Error) {
        throw error;
      }

      throw new Error('Payment creation failed - please try again');
    }
  }

  /**
   * Get payment status from database
   * @param paymentId - The payment ID to check
   * @returns Payment session with current status
   */
  async getPaymentStatus(paymentId: string): Promise<PaymentSession> {
    try {
      console.log('Getting payment status for:', paymentId);

      // Check online status
      const isOnline = await this.checkOnlineStatus();

      if (isOnline) {
        const { data, error } = await this.supabase
          .from('payments')
          .select('*')
          .eq('id', paymentId)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            throw new Error('Payment not found');
          }
          console.error('Database error:', error);
          throw new Error(`Failed to get payment status: ${error.message}`);
        }

        if (!data) {
          throw new Error('Payment not found');
        }

        // Transform database record to PaymentSession format
        return {
          paymentId: data.id,
          duitkuTransactionId: data.duitku_transaction_id,
          qrUrl: data.qr_code,
          amount: data.amount,
          expiresAt: data.expires_at,
          status: this.mapPaymentStatus(data.status)
        };
      } else {
        // Offline mode: return a default status indicating offline state
        return {
          paymentId: paymentId,
          duitkuTransactionId: '',
          qrUrl: '',
          amount: 0,
          expiresAt: new Date().toISOString(),
          status: 'pending' // Default to pending when offline
        };
      }

    } catch (error) {
      console.error('Get payment status error:', error);

      if (error instanceof Error) {
        throw error;
      }

      throw new Error('Failed to get payment status');
    }
  }

  /**
   * Subscribe to real-time payment status updates
   * @param paymentId - The payment ID to monitor
   * @param callback - Callback function for status updates
   * @returns Subscription object with unsubscribe method
   */
  async subscribeToPaymentUpdates(
    paymentId: string,
    callback: (payment: PaymentSession) => void
  ) {
    console.log('Subscribing to payment updates for:', paymentId);

    // Check online status
    const isOnline = await this.checkOnlineStatus();

    if (!isOnline) {
      console.log('Offline mode: cannot subscribe to real-time payment updates');
      // Return a mock subscription that does nothing
      return {
        unsubscribe: () => {
          console.log('No active subscription to unsubscribe');
        }
      };
    }

    // Get current user ID for quota subscription
    const currentUserId = await this.getCurrentUserId();

    const subscription = this.supabase
      .channel(`payment-${paymentId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'payments',
          filter: `id=eq.${paymentId}`
        },
        (payload: any) => {
          console.log('Payment update received:', payload);

          const updatedPayment = payload.new;
          const paymentSession: PaymentSession = {
            paymentId: updatedPayment.id,
            duitkuTransactionId: updatedPayment.duitku_transaction_id,
            qrUrl: updatedPayment.qr_code,
            amount: updatedPayment.amount,
            expiresAt: updatedPayment.expires_at,
            status: this.mapPaymentStatus(updatedPayment.status)
          };

          callback(paymentSession);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_quotas',
          ...(currentUserId && { filter: `user_id=eq.${currentUserId}` })
        },
        (payload: any) => {
          console.log('Quota update received:', payload);
          // This will be handled by the quota service
        }
      )
      .subscribe((status: string) => {
        console.log('Subscription status:', status);
      });

    return {
      unsubscribe: () => {
        console.log('Unsubscribing from payment updates for:', paymentId);
        subscription.unsubscribe();
      }
    };
  }

  /**
   * Cancel a pending payment
   * @param paymentId - The payment ID to cancel
   */
  async cancelPayment(paymentId: string): Promise<void> {
    try {
      console.log('Cancelling payment:', paymentId);

      // Check online status
      const isOnline = await this.checkOnlineStatus();

      if (!isOnline) {
        throw new Error('Payment cancellation requires an active internet connection');
      }

      const { error } = await this.supabase
        .from('payments')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', paymentId)
        .eq('status', 'pending');

      if (error) {
        console.error('Payment cancellation error:', error);
        throw new Error(`Failed to cancel payment: ${error.message}`);
      }

      console.log('Payment cancelled successfully:', paymentId);

    } catch (error) {
      console.error('Cancel payment error:', error);

      if (error instanceof Error) {
        throw error;
      }

      throw new Error('Failed to cancel payment');
    }
  }

  /**
   * Get payment history for the current user
   * @param limit - Maximum number of payments to return
   * @returns Array of payment sessions
   */
  async getPaymentHistory(limit: number = 10): Promise<PaymentSession[]> {
    try {
      console.log('Getting payment history with limit:', limit);

      // Check online status
      const isOnline = await this.checkOnlineStatus();

      if (isOnline) {
        const currentUserId = await this.getCurrentUserId();
        if (!currentUserId) {
          throw new Error('User not authenticated');
        }

        const { data, error } = await this.supabase
          .from('payments')
          .select('*')
          .eq('user_id', currentUserId)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) {
          console.error('Payment history error:', error);
          throw new Error(`Failed to get payment history: ${error.message}`);
        }

        // Transform database records to PaymentSession format
        return (data || []).map((payment: any) => ({
          paymentId: payment.id,
          duitkuTransactionId: payment.duitku_transaction_id,
          qrUrl: payment.qr_code,
          amount: payment.amount,
          expiresAt: payment.expires_at,
          status: this.mapPaymentStatus(payment.status)
        }));
      } else {
        // Offline mode: return empty array since payment history is stored server-side
        console.log('Offline mode: returning empty payment history');
        return [];
      }

    } catch (error) {
      console.error('Get payment history error:', error);

      if (error instanceof Error) {
        throw error;
      }

      throw new Error('Failed to get payment history');
    }
  }

  /**
   * Validate payment amount for a subscription plan
   * @param planType - The subscription plan
   * @param amount - The amount to validate
   * @returns true if amount is valid for the plan
   */
  validatePaymentAmount(planType: SubscriptionPlan, amount: number): boolean {
    const PLAN_AMOUNTS = {
      basic: 0,        // Free plan
      premium: 99000,  // IDR 99,000
      enterprise: 299000 // IDR 299,000
    };

    const expectedAmount = PLAN_AMOUNTS[planType];
    return amount === expectedAmount;
  }

  /**
   * Get subscription plan details
   * @param planType - The subscription plan
   * @returns Plan configuration details
   */
  getPlanDetails(planType: SubscriptionPlan) {
    const PLAN_DETAILS = {
      basic: {
        name: 'Basic',
        price: 0,
        messages_limit: 500,
        features: ['500 messages/month', 'Basic templates', 'Email support']
      },
      premium: {
        name: 'Premium',
        price: 99000, // IDR 99,000
        messages_limit: 1500,
        features: ['1,500 messages/month', 'Advanced templates', 'Priority support', 'Contact groups']
      },
      enterprise: {
        name: 'Enterprise',
        price: 299000, // IDR 299,000
        messages_limit: 5000,
        features: ['5,000 messages/month', 'Custom templates', '24/7 support', 'API access', 'Analytics']
      }
    };

    return PLAN_DETAILS[planType];
  }

  /**
   * Map database status to frontend status
   * @param dbStatus - Database status value
   * @returns Frontend payment status
   */
  private mapPaymentStatus(dbStatus: string): PaymentSession['status'] {
    const statusMap: Record<string, PaymentSession['status']> = {
      'pending': 'pending',
      'completed': 'completed',
      'failed': 'failed',
      'expired': 'expired'
    };

    return statusMap[dbStatus] || 'failed';
  }

  /**
   * Get current user ID from UserContextManager
   * @returns Current user ID or null if not authenticated
   */
  private async getCurrentUserId(): Promise<string | null> {
    try {
      const user = await userContextManager.getCurrentUser();
      return user?.id || null;
    } catch (error) {
      console.error('Error getting current user ID:', error);
      return null;
    }
  }
}

// Export default instance for convenience
export const paymentService = new PaymentService();
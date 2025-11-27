import { supabase } from '@/lib/supabase';

// Object-based service for new Settings Page
export const paymentService = {
  async createPayment(planId: string, paymentMethod: string) {
    const { data, error } = await supabase.functions.invoke('create-payment', {
      body: {
        plan_id: planId,
        payment_method: paymentMethod,
        return_url: `${window.location.origin}/settings` // Send current origin (e.g., http://localhost:3000/settings)
      }
    });

    if (error) {
      console.error('Error creating payment:', error);
      throw error;
    }
    return data;
  },

  async verifyPayment(transactionId: string) {
    const { data, error } = await supabase.functions.invoke('verify-payment', {
      body: { transaction_id: transactionId }
    });

    if (error) {
      console.error('Error verifying payment:', error);
      throw error;
    }
    return data;
  },

  async subscribeToPaymentUpdates(paymentId: string, callback: (session: any) => void) {
    // Subscribe to realtime updates for a specific payment transaction
    const channel = supabase
      .channel(`payment:${paymentId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'payment_transactions',
          filter: `id=eq.${paymentId}`
        },
        (payload) => {
          callback(payload.new);
        }
      )
      .subscribe();

    return {
      unsubscribe: () => channel.unsubscribe()
    };
  },

  async cancelPayment(paymentId: string) {
    const { data, error } = await supabase
      .from('payment_transactions')
      .update({ status: 'expired' })
      .eq('id', paymentId)
      .select()
      .single();

    if (error) {
      console.error('Error cancelling payment:', error);
      throw error;
    }
    return data;
  }
};

import { SyncManager } from '../sync/SyncManager';

// Class-based service for backward compatibility with Dashboard
export class PaymentService {
  private syncManager: SyncManager | null = null;

  constructor(syncManager?: SyncManager) {
    this.syncManager = syncManager || null;
  }
  async createPayment(planType: string, amount: number, userId: string) {
    const { data, error } = await supabase.functions.invoke('create-payment', {
      body: {
        plan_type: planType,
        amount: amount,
        user_id: userId,
        return_url: `${window.location.origin}/subscription`
      }
    });

    if (error) {
      console.error('Error creating payment:', error);
      throw error;
    }
    return data;
  }

  async subscribeToPaymentUpdates(paymentId: string, callback: (payment: any) => void) {
    // Subscribe to realtime updates for a specific payment transaction
    const channel = supabase
      .channel(`payment:${paymentId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'payment_transactions',
          filter: `id=eq.${paymentId}`
        },
        (payload) => {
          callback(payload.new);
        }
      )
      .subscribe();

    return {
      unsubscribe: () => channel.unsubscribe()
    };
  }

  async cancelPayment(paymentId: string) {
    const { data, error } = await supabase
      .from('payment_transactions')
      .update({ status: 'expired' })
      .eq('id', paymentId)
      .select()
      .single();

    if (error) {
      console.error('Error cancelling payment:', error);
      throw error;
    }
    return data;
  }
}
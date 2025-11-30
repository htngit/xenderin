// Supabase client configuration and helper functions
import { createClient } from '@supabase/supabase-js';
import { Quota } from './services/types'; //User gue hilangin, check lagi ada error gak

// Environment variables validation
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Auth helper functions
export const authHelpers = {
  async signInWithEmail(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  },

  async signUpWithEmail(email: string, password: string, metadata?: Record<string, any>) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data;
  },

  async resetPasswordForEmail(email: string, redirectTo?: string) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectTo || `${window.location.origin}/reset-password`
    });
    if (error) throw error;
    return data;
  },

  async updatePassword(newPassword: string) {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    });
    if (error) throw error;
    return data;
  },

  async verifyOtp(email: string, token: string, type: 'recovery' | 'signup' | 'email' = 'recovery') {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type
    });
    if (error) throw error;
    return data;
  }
};

// RPC helper functions for quota management
export const rpcHelpers = {
  async checkQuotaUsage(userId: string): Promise<Quota> {
    try {
      const { data, error } = await supabase.rpc('check_quota_usage', {
        p_user_id: userId
      });

      if (error) throw error;

      if (!data || data.length === 0) {
        // Return default quota if no data found
        return {
          id: 'default',
          user_id: userId,
          master_user_id: userId,
          plan_type: 'basic',
          messages_limit: 1000,
          messages_used: 0,
          remaining: 1000,
          reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }

      const quotaData = data[0];
      return {
        id: quotaData.quota_id || 'unknown',
        user_id: userId,
        master_user_id: quotaData.master_user_id || userId,
        plan_type: quotaData.plan_type,
        messages_limit: quotaData.messages_limit,
        messages_used: quotaData.messages_used,
        remaining: quotaData.messages_remaining,
        reset_date: quotaData.reset_date,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error checking quota usage:', error);
      throw error;
    }
  },

  async reserveQuota(userId: string, messageCount: number = 1) {
    try {
      const { data, error } = await supabase.rpc('reserve_quota', {
        p_user_id: userId,
        p_amount: messageCount
      });

      if (error) throw error;

      const result = data[0];
      return {
        success: result.success,
        reservation_id: result.reservation_id,
        messages_remaining: result.messages_remaining,
        error_message: result.error_message
      };
    } catch (error) {
      console.error('Error reserving quota:', error);
      return {
        success: false,
        quota_id: null,
        messages_remaining: 0,
        error_message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  async commitQuotaUsage(reservationId: string, successCount: number = 1) {
    try {
      const { data, error } = await supabase.rpc('commit_quota_usage', {
        p_reservation_id: reservationId,
        p_success_count: successCount
      });

      if (error) throw error;

      const result = data[0];
      return {
        success: result.success,
        messages_remaining: result.messages_remaining,
        error_message: result.error_message
      };
    } catch (error) {
      console.error('Error committing quota usage:', error);
      return {
        success: false,
        messages_remaining: 0,
        error_message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  async getUserQuota(userId: string): Promise<Quota[]> {
    try {
      console.log('Getting user quota for:', userId);

      const { data, error } = await supabase
        .from('user_quotas')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) {
        console.error('Database error:', error);
        // Return empty array instead of throwing for new users
        if (error.code === 'PGRST116' || error.message.includes('not found')) {
          console.log('No quota found, returning empty array');
          return [];
        }
        throw error;
      }

      if (!data || data.length === 0) {
        console.log('No quota data found for user, returning empty array');
        return [];
      }

      console.log('Found quota data:', data.length, 'records');

      return data.map(quota => ({
        id: quota.id,
        user_id: quota.user_id,
        master_user_id: quota.master_user_id,
        plan_type: quota.plan_type,
        messages_limit: quota.messages_limit,
        messages_used: quota.messages_used,
        remaining: quota.messages_limit - quota.messages_used,
        reset_date: quota.reset_date,
        is_active: quota.is_active,
        created_at: quota.created_at,
        updated_at: quota.updated_at
      }));
    } catch (error) {
      console.error('Error getting user quota:', error);
      // Return empty array instead of throwing to prevent login failure
      return [];
    }
  }
};

// Database error handling
export function handleDatabaseError(error: any): string {
  if (error.code === 'PGRST116') {
    return 'Record not found';
  }
  if (error.code === '23505') {
    return 'Duplicate record';
  }
  if (error.code === '23503') {
    return 'Foreign key constraint violation';
  }
  if (error.code === '23502') {
    return 'Required field missing';
  }
  return error.message || 'Database error occurred';
}
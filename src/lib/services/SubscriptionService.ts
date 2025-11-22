import { supabase } from '@/lib/supabase';
import { Subscription, PricingPlan, PaymentTransaction } from '@/types/subscription';

export interface UserQuota {
    user_id: string;
    plan_type: string;
    messages_limit: number;
    messages_used: number;
    reset_date: string;
}

export const subscriptionService = {
    async getCurrentSubscription(): Promise<Subscription | null> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('master_user_id', user.id)
            .single();

        if (error) {
            console.error('Error fetching subscription:', error);
            return null;
        }
        return data;
    },

    async getPricingPlans(): Promise<PricingPlan[]> {
        const { data, error } = await supabase
            .from('pricing_plans')
            .select('*')
            .eq('is_active', true)
            .order('price', { ascending: true });

        if (error) {
            console.error('Error fetching pricing plans:', error);
            throw error;
        }
        return data || [];
    },

    async getPaymentHistory(): Promise<PaymentTransaction[]> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('payment_transactions')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching payment history:', error);
            throw error;
        }
        return data || [];
    },

    async getUserQuota(): Promise<UserQuota | null> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('user_quotas')
            .select('*')
            .eq('master_user_id', user.id)
            .single();

        if (error) {
            console.error('Error fetching quota:', error);
            return null;
        }
        return data;
    }
};

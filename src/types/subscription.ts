export type PlanType = 'free' | 'basic' | 'pro';
export type BillingCycle = 'monthly' | 'yearly';
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'past_due' | 'trialing';
export type PaymentStatus = 'pending' | 'success' | 'failed' | 'expired';

export interface Subscription {
    id: string;
    master_user_id: string;
    plan_type: PlanType;
    status: SubscriptionStatus;
    billing_cycle: BillingCycle;
    price: number;
    currency: string;
    valid_from: string;
    valid_until: string;
    quota_reset_date: string;
    cancel_at_period_end: boolean;
    created_at: string;
    updated_at: string;
}

export interface PricingPlan {
    id: string;
    plan_type: PlanType;
    plan_name: string;
    price: number;
    currency: string;
    billing_cycle: BillingCycle;
    features: string[]; // JSON array in DB
    quota: number;
    is_active: boolean;
    description?: string;
    created_at: string;
}

export interface PaymentTransaction {
    id: string;
    user_id: string;
    transaction_id: string; // Duitku Reference
    merchant_order_id: string;
    amount: number;
    status: PaymentStatus;
    payment_method: string;
    plan_purchased: PlanType;
    quota_added: number;
    duitku_reference?: string;
    duitku_payment_url?: string;
    duitku_qr_string?: string;
    duitku_va_number?: string;
    paid_at?: string;
    expired_at?: string;
    created_at: string;
    updated_at: string;
}

export interface CreatePaymentResponse {
    transaction_id: string;
    payment_url: string;
    merchant_order_id: string;
    amount: number;
    // ... other fields
}

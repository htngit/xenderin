-- Migration: Inject Pro Plan with Unlimited Quota for User
-- User ID: 3aa07c0f-2208-46e5-a483-03731e3a3e24
-- Description: Upgrade user to Pro Monthly plan with unlimited messages for 1 month
-- Author: Kilo Code
-- Date: 2025-12-23
-- Purpose: Provide Pro Plan subscription with unlimited quota for testing purposes

BEGIN;

-- Step 1: Ensure Pro plan exists in pricing_plans table with correct schema
INSERT INTO pricing_plans (
    plan_type,
    plan_name,
    billing_cycle,
    price,
    quota,
    features,
    is_active,
    discount_percentage
) VALUES (
    'pro',
    'Pro Monthly',
    'monthly',
    100000.00,
    999999, -- Unlimited quota
    '["Unlimited messages", "Priority support", "Advanced analytics", "Team management"]'::jsonb,
    true,
    0
) ON CONFLICT (plan_name) 
DO UPDATE SET 
    plan_type = EXCLUDED.plan_type,
    billing_cycle = EXCLUDED.billing_cycle,
    price = EXCLUDED.price,
    quota = EXCLUDED.quota,
    features = EXCLUDED.features,
    is_active = EXCLUDED.is_active,
    discount_percentage = EXCLUDED.discount_percentage;

-- Step 2: Update or create subscription record for the user with correct schema
INSERT INTO subscriptions (
    master_user_id,
    plan_type,
    billing_cycle,
    status,
    price,
    currency,
    valid_from,
    valid_until,
    next_billing_date,
    quota_reset_date,
    auto_renew,
    scheduled_downgrade_to,
    scheduled_downgrade_date,
    grace_period_ends_at,
    created_at,
    updated_at
) VALUES (
    '3aa07c0f-2208-46e5-a483-03731e3a3e24',
    'pro',
    'monthly',
    'active',
    100000.00,
    'IDR',
    NOW(),
    NOW() + INTERVAL '31 days', -- 1 month subscription
    NULL, -- next_billing_date
    date_trunc('month', NOW()) + INTERVAL '1 month', -- quota_reset_date
    false, -- auto_renew
    NULL, -- scheduled_downgrade_to
    NULL, -- scheduled_downgrade_date
    NULL, -- grace_period_ends_at
    NOW(), -- created_at
    NOW() -- updated_at
) ON CONFLICT (master_user_id) 
DO UPDATE SET
    plan_type = EXCLUDED.plan_type,
    billing_cycle = EXCLUDED.billing_cycle,
    status = EXCLUDED.status,
    price = EXCLUDED.price,
    currency = EXCLUDED.currency,
    valid_from = EXCLUDED.valid_from,
    valid_until = EXCLUDED.valid_until,
    next_billing_date = EXCLUDED.next_billing_date,
    quota_reset_date = EXCLUDED.quota_reset_date,
    auto_renew = EXCLUDED.auto_renew,
    scheduled_downgrade_to = EXCLUDED.scheduled_downgrade_to,
    scheduled_downgrade_date = EXCLUDED.scheduled_downgrade_date,
    grace_period_ends_at = EXCLUDED.grace_period_ends_at,
    updated_at = NOW();

-- Step 3: Update user_quotas to reflect Pro plan with unlimited messages using correct schema
UPDATE user_quotas SET
    plan_type = 'pro',
    messages_limit = 999999, -- Unlimited messages
    messages_used = 0,
    reset_date = (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::date,
    is_active = true,
    updated_at = NOW()
WHERE user_id = '3aa07c0f-2208-46e5-a483-03731e3a3e24'
   OR master_user_id = '3aa07c0f-2208-46e5-a483-03731e3a3e24';

-- Step 4: Insert into user_quotas if record doesn't exist with correct schema
INSERT INTO user_quotas (
    user_id,
    master_user_id,
    plan_type,
    messages_limit,
    messages_used,
    reset_date,
    is_active,
    created_at,
    updated_at
) 
SELECT
    '3aa07c0f-2208-46e5-a483-03731e3a3e24',
    '3aa07c0f-2208-46e5-a483-03731e3a3e24',
    'pro',
    999999,
    0,
    (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::date,
    true,
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM user_quotas 
    WHERE user_id = '3aa07c0f-2208-46e5-a483-03731e3a3e24'
       OR master_user_id = '3aa07c0f-2208-46e5-a483-03731e3a3e24'
);

-- Step 5: Verify the injection was successful
DO $$
DECLARE
    v_subscription_count INTEGER;
    v_quota_count INTEGER;
    v_plan_count INTEGER;
BEGIN
    -- Check subscription record
    SELECT COUNT(*) INTO v_subscription_count
    FROM subscriptions
    WHERE master_user_id = '3aa07c0f-2208-46e5-a483-03731e3a3e24'
    AND plan_type = 'pro'
    AND valid_until >= NOW() + INTERVAL '30 days'
    AND status = 'active';

    -- Check user quota record
    SELECT COUNT(*) INTO v_quota_count
    FROM user_quotas
    WHERE (user_id = '3aa07c0f-2208-46e5-a483-03731e3a3e24'
       OR master_user_id = '3aa07c0f-2208-46e5-a483-03731e3a3e24')
    AND plan_type = 'pro'
    AND messages_limit = 999999
    AND is_active = true;

    -- Check pricing plan exists
    SELECT COUNT(*) INTO v_plan_count
    FROM pricing_plans
    WHERE plan_name = 'Pro Monthly'
    AND plan_type = 'pro'
    AND is_active = true;

    IF v_subscription_count = 0 OR v_quota_count = 0 OR v_plan_count = 0 THEN
        RAISE EXCEPTION 'Pro Plan injection failed for user 3aa07c0f-2208-46e5-a483-03731e3a3e24';
    END IF;

    RAISE NOTICE 'Successfully injected Pro Plan with Unlimited quota for user 3aa07c0f-2208-46e5-a483-03731e3a3e24';
    RAISE NOTICE 'Subscription valid until: %', (NOW() + INTERVAL '31 days')::text;
    RAISE NOTICE 'Messages limit: Unlimited (999999)';
    RAISE NOTICE 'Plan features: Unlimited messages, Priority support, Advanced analytics, Team management';
END $$;

COMMIT;
-- Migration: Update Pro Plan Features
-- Remove "Max 300/hour recommended" and "API access" from Pro plan features

-- Update Pro - Monthly plan
UPDATE pricing_plans
SET features = '["Unlimited messages", "Priority support", "Analytics"]'::jsonb
WHERE plan_name = 'Pro - Monthly';

-- Update Pro - Yearly plan
UPDATE pricing_plans
SET features = '["Unlimited messages", "Priority support", "Analytics"]'::jsonb
WHERE plan_name = 'Pro - Yearly';

-- If plans don't exist yet, insert them with correct features
INSERT INTO pricing_plans (plan_type, plan_name, billing_cycle, price, quota, features, is_active)
VALUES 
  ('pro', 'Pro - Monthly', 'monthly', 100000, 999999, '["Unlimited messages", "Priority support", "Analytics"]'::jsonb, true),
  ('pro', 'Pro - Yearly', 'yearly', 960000, 999999, '["Unlimited messages", "Priority support", "Analytics"]'::jsonb, true)
ON CONFLICT (plan_name) DO UPDATE
SET features = EXCLUDED.features;

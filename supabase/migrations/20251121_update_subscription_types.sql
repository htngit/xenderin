-- Migration: Update Subscription Types
-- Description: Changes plan_type enum from (basic, premium, enterprise) to (free, basic, pro)
--              Updates existing data and defaults.

-- 1. Drop old CHECK constraint
ALTER TABLE user_quotas 
DROP CONSTRAINT IF EXISTS user_quotas_plan_type_check;

-- 2. Add new CHECK constraint
ALTER TABLE user_quotas 
ADD CONSTRAINT user_quotas_plan_type_check 
CHECK (plan_type IN ('free', 'basic', 'pro'));

-- 3. Migrate existing data
-- basic -> free
-- premium -> basic
-- enterprise -> pro
UPDATE user_quotas
SET plan_type = CASE 
  WHEN plan_type = 'basic' THEN 'free'
  WHEN plan_type = 'premium' THEN 'basic'
  WHEN plan_type = 'enterprise' THEN 'pro'
  ELSE plan_type
END;

-- 4. Update quota limits for migrated plans
UPDATE user_quotas
SET messages_limit = CASE 
  WHEN plan_type = 'free' THEN 5
  WHEN plan_type = 'basic' THEN 500
  WHEN plan_type = 'pro' THEN 999999
  ELSE messages_limit
END;

-- 5. Update default values
ALTER TABLE user_quotas 
ALTER COLUMN plan_type SET DEFAULT 'free';

ALTER TABLE user_quotas 
ALTER COLUMN messages_limit SET DEFAULT 5;

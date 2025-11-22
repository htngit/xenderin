-- Migration: Settings Page Schema
-- Description: Adds tables for Subscriptions, User Settings, Pricing Plans, Payments, Billing, and Refunds.
-- Strategy: ZERO BREAKING CHANGES. No ALTER to existing tables. Syncs to user_quotas via triggers.

-- 1. Enable UUID extension if not exists (standard for Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Subscriptions Table (Billing Layer)
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  master_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  
  -- Plan Info
  plan_type TEXT NOT NULL DEFAULT 'free' CHECK (plan_type IN ('free', 'basic', 'pro')),
  billing_cycle TEXT DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'pending')),
  
  -- Pricing
  price DECIMAL(10,2) DEFAULT 0,
  currency TEXT DEFAULT 'IDR',
  
  -- Dates
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  next_billing_date TIMESTAMPTZ,
  quota_reset_date TIMESTAMPTZ DEFAULT DATE_TRUNC('month', NOW() + INTERVAL '1 month'),
  
  -- Auto-renewal
  auto_renew BOOLEAN DEFAULT false,
  
  -- Scheduled Changes
  scheduled_downgrade_to TEXT,
  scheduled_downgrade_date TIMESTAMPTZ,
  
  -- Grace Period
  grace_period_ends_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subscription" ON subscriptions FOR SELECT USING (auth.uid() = master_user_id);
CREATE POLICY "Users can update own subscription" ON subscriptions FOR UPDATE USING (auth.uid() = master_user_id);

-- Indexes for subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(master_user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status, next_billing_date);

-- 3. Sync Trigger (Auto-sync subscriptions -> user_quotas)
CREATE OR REPLACE FUNCTION sync_subscription_to_quota()
RETURNS TRIGGER AS $$
BEGIN
  -- Update user_quotas when subscription changes
  UPDATE user_quotas
  SET 
    plan_type = NEW.plan_type,
    messages_limit = CASE 
      WHEN NEW.plan_type = 'free' THEN 5
      WHEN NEW.plan_type = 'basic' THEN 500
      WHEN NEW.plan_type = 'pro' THEN 999999 -- "unlimited"
    END,
    reset_date = DATE_TRUNC('month', NOW() + INTERVAL '1 month')::date,
    updated_at = NOW()
  WHERE master_user_id = NEW.master_user_id;
  
  -- If user_quotas doesn't exist, create it
  IF NOT FOUND THEN
    INSERT INTO user_quotas (user_id, master_user_id, plan_type, messages_limit, messages_used, reset_date)
    VALUES (
      NEW.master_user_id,
      NEW.master_user_id,
      NEW.plan_type,
      CASE 
        WHEN NEW.plan_type = 'free' THEN 5
        WHEN NEW.plan_type = 'basic' THEN 500
        WHEN NEW.plan_type = 'pro' THEN 999999
      END,
      0,
      DATE_TRUNC('month', NOW() + INTERVAL '1 month')::date
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on INSERT or UPDATE
DROP TRIGGER IF EXISTS subscription_changed ON subscriptions;
CREATE TRIGGER subscription_changed
  AFTER INSERT OR UPDATE OF plan_type ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION sync_subscription_to_quota();

-- 4. User Settings Table
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  
  -- Preferences
  language TEXT DEFAULT 'id' CHECK (language IN ('id', 'en')),
  timezone TEXT DEFAULT 'Asia/Jakarta',
  theme TEXT DEFAULT 'dark' CHECK (theme IN ('light', 'dark')),
  
  -- Notifications
  enable_push_notifications BOOLEAN DEFAULT true,
  enable_email_notifications BOOLEAN DEFAULT false,
  notify_on_message_sent BOOLEAN DEFAULT true,
  notify_on_message_failed BOOLEAN DEFAULT true,
  notify_on_session_disconnect BOOLEAN DEFAULT true,
  
  -- Message Settings
  default_message_delay INTEGER DEFAULT 3000, -- milliseconds
  max_messages_per_batch INTEGER DEFAULT 50,
  retry_failed_messages BOOLEAN DEFAULT true,
  max_retry_attempts INTEGER DEFAULT 3,
  
  -- Media Settings
  max_file_size INTEGER DEFAULT 10485760, -- 10MB
  auto_compress_images BOOLEAN DEFAULT true,
  
  -- Sync Settings
  enable_offline_mode BOOLEAN DEFAULT true,
  auto_sync_interval INTEGER DEFAULT 300000, -- 5 minutes
  
  -- Security
  two_factor_enabled BOOLEAN DEFAULT false,
  data_retention_days INTEGER DEFAULT 30,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for user_settings
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own settings" ON user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON user_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5. Pricing Plans Table
CREATE TABLE IF NOT EXISTS pricing_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_type TEXT NOT NULL CHECK (plan_type IN ('free', 'basic', 'pro')),
  plan_name TEXT UNIQUE NOT NULL,
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  price DECIMAL(10,2) NOT NULL,
  quota INTEGER NOT NULL, -- -1 for unlimited
  features JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  discount_percentage INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for pricing_plans
ALTER TABLE pricing_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active plans" ON pricing_plans FOR SELECT USING (is_active = true);

-- 6. Payment Transactions Table
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Transaction Info
  transaction_id TEXT UNIQUE NOT NULL, -- DUITKU reference
  merchant_order_id TEXT UNIQUE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'IDR',
  
  -- Payment Details
  payment_method TEXT NOT NULL,
  payment_provider TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'expired')),
  
  -- Plan Info
  plan_purchased TEXT NOT NULL,
  quota_added INTEGER NOT NULL,
  
  -- DUITKU Fields
  duitku_reference TEXT,
  duitku_payment_url TEXT,
  duitku_qr_string TEXT,
  duitku_va_number TEXT,
  
  -- Invoice
  invoice_number TEXT UNIQUE,
  invoice_pdf_url TEXT,
  tax_percentage DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2),
  
  -- Timestamps
  paid_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for payment_transactions
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own transactions" ON payment_transactions FOR SELECT USING (auth.uid() = user_id);

-- Indexes for payment_transactions
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user ON payment_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status, created_at DESC);

-- 7. Billing Information Table
CREATE TABLE IF NOT EXISTS billing_information (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  
  full_name TEXT NOT NULL,
  company_name TEXT,
  tax_id TEXT, -- NPWP
  email TEXT NOT NULL,
  phone TEXT,
  
  -- Address
  street_address TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'Indonesia',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for billing_information
ALTER TABLE billing_information ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own billing info" ON billing_information FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own billing info" ON billing_information FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own billing info" ON billing_information FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 8. Refund Requests Table
CREATE TABLE IF NOT EXISTS refund_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES payment_transactions(id),
  
  refund_number TEXT UNIQUE NOT NULL, -- REF-YYYY-MM-XXXXX
  reason TEXT NOT NULL,
  details TEXT NOT NULL,
  
  -- Bank Info
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_holder TEXT NOT NULL,
  
  -- Status
  status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'approved', 'rejected', 'transferred')),
  admin_notes TEXT,
  refund_amount DECIMAL(10,2),
  
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for refund_requests
ALTER TABLE refund_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own refund requests" ON refund_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own refund requests" ON refund_requests FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Indexes for refund_requests
CREATE INDEX IF NOT EXISTS idx_refund_requests_user ON refund_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON refund_requests(status, created_at DESC);

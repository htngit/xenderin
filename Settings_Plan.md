# Settings Page - Detailed Implementation Plan

> **Project**: Xender-In WhatsApp Automation  
> **Feature**: Complete Settings Page with Payment & Subscription  
> **Version**: 1.0  
> **Last Updated**: 2025-11-21

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Pricing & Policies](#pricing--policies)
3. [Phase 1: Database Schema](#phase-1-database-schema)
4. [Phase 2: Edge Functions](#phase-2-edge-functions)
5. [Phase 3: Types & Services](#phase-3-types--services)
6. [Phase 4: UI Components - Payment Tab](#phase-4-ui-components---payment-tab)
7. [Phase 5: UI Components - Other Tabs](#phase-5-ui-components---other-tabs)
8. [Phase 6: Integration](#phase-6-integration)
9. [Phase 7: Testing](#phase-7-testing)
10. [Implementation Rules](#implementation-rules)

---

## Overview

### Goal
Build comprehensive Settings Page with 8 tabs:
1. 🔐 WhatsApp Session (placeholder for backend)
2. 💳 Payment & Subscription (DUITKU integration)
3. 👤 Account & Profile
4. 🔔 Notifications
5. 💬 Message Settings
6. 🔄 Database & Sync
7. 🔒 Security & Privacy
8. 👥 Team Management (LOCKED - future CRM)

### Tech Stack
- **Frontend**: React + TypeScript + Vite
- **UI**: shadcn/ui + Tailwind CSS
- **Forms**: react-hook-form + Zod
- **Backend**: Supabase (Auth, Database, Edge Functions, Storage)
- **Payment**: DUITKU Sandbox API
- **PDF**: jsPDF or Puppeteer for invoice generation

### Timeline
**Total: 14-18 days** (3-4 weeks)

---

## Pricing & Policies

### Pricing Structure (LOCKED)

| Plan | Monthly | Yearly | Quota | Notes |
|------|---------|--------|-------|-------|
| **Free** | Rp 0 | - | 5 msg/month | Default for new users |
| **Basic** | Rp 50,000 | Rp 480,000 | 500 msg/month | Save Rp 120K/year (20% off) |
| **Pro** | Rp 75,000 | Rp 720,000 | Unlimited | Save Rp 180K/year (20% off) |

### Key Policies

✅ **Quota Reset**: Every 1st of month at 00:00 WIB (GMT+7)  
✅ **No Prorated Charges**: Upgrade = immediate full charge, full quota  
✅ **Downgrade**: Effective next billing cycle  
✅ **Monthly → Yearly Switch**: Immediate charge, previous payment hangus  
✅ **Grace Period**: 3 days for failed payments  
✅ **Refund**: 14 days for service complaints, transfer to bank  
✅ **Rate Limit**: Warning only for >300 msg/hour  
✅ **New User**: Auto Free plan with 5 messages  

### Company Info (for Invoices)

```
Xalesin
Jakarta Selatan, Pasar Minggu
Jakarta, Indonesia
Email: xalesincare@xalesin.id
Phone: - (empty but field exists)
NPWP: - (empty but field exists)
Tax: 0% (placeholder for future)
```

---

## Phase 1: Database Schema (SAFE - No Breaking Changes)

**Duration**: 1 day  
**File**: `supabase/migrations/20251121_settings_schema.sql`

> **⚠️ CRITICAL: ZERO BREAKING CHANGES**  
> - ❌ NO ALTER to existing tables (`user_quotas`, `quota_reservations`, `profiles`)
> - ✅ Only CREATE new tables
> - ✅ Sync via triggers (automatic, backward compatible)
> - ✅ Existing code continues to work without changes

### Existing Tables (DO NOT MODIFY)

**Already in database - KEEP AS IS:**
- ✅ `user_quotas` - Quota tracking (plan_type, messages_limit, messages_used, reset_date)
- ✅ `quota_reservations` - Reserve/commit flow
- ✅ `profiles` - User profiles (name, email, avatar, role)

### Integration Strategy

```
New: subscriptions (billing layer)
        ↓ (auto-sync via trigger)
Existing: user_quotas (quota layer) ← NO CHANGES, existing code reads from here
        ↓ (existing relationship)
Existing: quota_reservations ← NO CHANGES
```

### Tasks Checklist

#### 1.1 Create Migration File
- [ ] Create `supabase/migrations/` directory if not exists
- [ ] Create `20251121_settings_schema.sql`
- [ ] Add migration header with SAFE strategy note

#### 1.2 Subscriptions Table (NEW - Billing Layer)
```sql
-- NEW TABLE: Billing & subscription management
CREATE TABLE subscriptions (
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

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subscription" ON subscriptions FOR SELECT USING (auth.uid() = master_user_id);
CREATE POLICY "Users can update own subscription" ON subscriptions FOR UPDATE USING (auth.uid() = master_user_id);

-- Index
CREATE INDEX idx_subscriptions_user ON subscriptions(master_user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status, next_billing_date);
```

#### 1.3 Sync Trigger (Auto-update user_quotas)
```sql
-- CRITICAL: Auto-sync subscriptions → user_quotas
-- This keeps existing code working without changes
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
CREATE TRIGGER subscription_changed
  AFTER INSERT OR UPDATE OF plan_type ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION sync_subscription_to_quota();
```

#### 1.4 User Settings Table (NEW)
```sql
CREATE TABLE user_settings (
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

-- RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own settings" ON user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON user_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
```

#### 1.5 Pricing Plans Table (NEW)
```sql
CREATE TABLE pricing_plans (
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

-- Insert pricing data
INSERT INTO pricing_plans (plan_type, plan_name, billing_cycle, price, quota, features, discount_percentage) VALUES
('free', 'Free Plan', 'monthly', 0, 5, '["5 messages per month", "Basic support"]', 0),
('basic', 'Basic - Monthly', 'monthly', 50000, 500, '["500 messages/month", "Email support", "Templates"]', 0),
('basic', 'Basic - Yearly', 'yearly', 480000, 500, '["500 messages/month", "Email support", "Templates", "Save Rp 120K/year"]', 20),
('pro', 'Pro - Monthly', 'monthly', 75000, -1, '["Unlimited messages", "Max 300/hour recommended", "Priority support", "Analytics", "API access"]', 0),
('pro', 'Pro - Yearly', 'yearly', 720000, -1, '["Unlimited messages", "Max 300/hour recommended", "Priority support", "Analytics", "API access", "Save Rp 180K/year"]', 20);

-- RLS
ALTER TABLE pricing_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active plans" ON pricing_plans FOR SELECT USING (is_active = true);
```

#### 1.6 Payment Transactions Table (NEW)
```sql
CREATE TABLE payment_transactions (
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

-- RLS
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own transactions" ON payment_transactions FOR SELECT USING (auth.uid() = user_id);

-- Index
CREATE INDEX idx_payment_transactions_user ON payment_transactions(user_id, created_at DESC);
CREATE INDEX idx_payment_transactions_status ON payment_transactions(status, created_at DESC);
```

#### 1.7 Billing Information Table (NEW)
```sql
CREATE TABLE billing_information (
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

-- RLS
ALTER TABLE billing_information ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own billing info" ON billing_information FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own billing info" ON billing_information FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own billing info" ON billing_information FOR INSERT WITH CHECK (auth.uid() = user_id);
```

#### 1.8 Refund Requests Table (NEW)
```sql
CREATE TABLE refund_requests (
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

-- RLS
ALTER TABLE refund_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own refund requests" ON refund_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own refund requests" ON refund_requests FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Index
CREATE INDEX idx_refund_requests_user ON refund_requests(user_id, created_at DESC);
CREATE INDEX idx_refund_requests_status ON refund_requests(status, created_at DESC);
```

#### 1.9 Initialize Default Subscriptions
```sql
-- Create free subscription for existing users
INSERT INTO subscriptions (master_user_id, plan_type, status, price, valid_from, valid_until)
SELECT 
  id,
  'free',
  'active',
  0,
  NOW(),
  NOW() + INTERVAL '100 years' -- Free plan never expires
FROM auth.users
WHERE id NOT IN (SELECT master_user_id FROM subscriptions)
ON CONFLICT (master_user_id) DO NOTHING;
```

#### 1.10 Execute Migration
- [ ] Save SQL file
- [ ] Review migration for safety (no ALTER existing tables)
- [ ] Use MCP Supabase tool: `apply_migration`
- [ ] Verify new tables created in Supabase dashboard
- [ ] Test sync trigger (update subscription, check user_quotas auto-updates)
- [ ] Verify pricing plans data inserted (5 rows)
- [ ] Verify default subscriptions created for existing users

### Verification Checklist
- [ ] All 6 new tables created (subscriptions, user_settings, pricing_plans, payment_transactions, billing_information, refund_requests)
- [ ] Sync trigger working (update subscriptions → user_quotas auto-updates)
- [ ] RLS enabled on all new tables
- [ ] Pricing plans data populated (5 rows)
- [ ] Indexes created
- [ ] Default free subscriptions created for existing users

**File**: `supabase/functions/create-payment/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    // 1. Get user from JWT
    const authHeader = req.headers.get('Authorization')!
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')
    
    // 2. Parse request
    const { plan_id, payment_method } = await req.json()
    
    // 3. Get plan details
    const { data: plan } = await supabase
      .from('pricing_plans')
      .select('*')
      .eq('id', plan_id)
      .single()
    
    if (!plan) throw new Error('Plan not found')
    
    // 4. Generate merchant order ID
    const merchantOrderId = `ORD-${Date.now()}-${user.id.substring(0, 8)}`
    
    // 5. Call DUITKU API
    const duitkuResponse = await fetch('https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchantCode: Deno.env.get('DUITKU_MERCHANT_CODE'),
        paymentAmount: plan.price,
        paymentMethod: payment_method,
        merchantOrderId: merchantOrderId,
        productDetails: `${plan.plan_name} Subscription`,
        email: user.email,
        customerVaName: user.email?.split('@')[0],
        callbackUrl: Deno.env.get('DUITKU_CALLBACK_URL'),
        returnUrl: Deno.env.get('DUITKU_RETURN_URL'),
        signature: generateSignature(merchantOrderId, plan.price)
      })
    })
    
    const duitkuData = await duitkuResponse.json()
    
    // 6. Save transaction
    const { data: transaction } = await supabase
      .from('payment_transactions')
      .insert({
        user_id: user.id,
        transaction_id: duitkuData.reference,
        merchant_order_id: merchantOrderId,
        amount: plan.price,
        payment_method: payment_method,
        status: 'pending',
        plan_purchased: plan.plan_name,
        quota_added: plan.quota,
        duitku_reference: duitkuData.reference,
        duitku_payment_url: duitkuData.paymentUrl,
        duitku_qr_string: duitkuData.qrString,
        duitku_va_number: duitkuData.vaNumber,
        total_amount: plan.price,
        expired_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      })
      .select()
      .single()
    
    return new Response(JSON.stringify(transaction), {
      headers: { 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})

function generateSignature(orderId: string, amount: number): string {
  // DUITKU signature logic
  const apiKey = Deno.env.get('DUITKU_API_KEY')
  const merchantCode = Deno.env.get('DUITKU_MERCHANT_CODE')
  const str = `${merchantCode}${orderId}${amount}${apiKey}`
  // Use crypto to generate MD5 hash
  return str // Simplified - implement proper MD5
}
```

**Tasks**:
- [ ] Create function directory
- [ ] Implement user authentication
- [ ] Implement plan validation
- [ ] Implement DUITKU API call
- [ ] Implement signature generation
- [ ] Save transaction to database
- [ ] Handle errors
- [ ] Test with Postman

### 2.2 Payment Webhook Function

**File**: `supabase/functions/payment-webhook/index.ts`

```typescript
serve(async (req) => {
  try {
    // 1. Parse DUITKU webhook
    const payload = await req.json()
    
    // 2. Verify signature
    if (!verifyDuitkuSignature(payload)) {
      throw new Error('Invalid signature')
    }
    
    // 3. Get transaction
    const supabase = createClient(...)
    const { data: transaction } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('merchant_order_id', payload.merchantOrderId)
      .single()
    
    if (!transaction) throw new Error('Transaction not found')
    
    // 4. Update transaction status
    await supabase
      .from('payment_transactions')
      .update({
        status: payload.resultCode === '00' ? 'success' : 'failed',
        paid_at: new Date(),
        duitku_reference: payload.reference
      })
      .eq('id', transaction.id)
    
    // 5. Update subscription if success
    if (payload.resultCode === '00') {
      await supabase
        .from('subscriptions')
        .update({
          plan_type: transaction.plan_purchased.includes('basic') ? 'basic' : 'pro',
          quota_limit: transaction.quota_added,
          quota_used: 0,
          valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: 'active'
        })
        .eq('master_user_id', transaction.user_id)
      
      // 6. Generate invoice
      await supabase.functions.invoke('generate-invoice', {
        body: { transaction_id: transaction.id }
      })
    }
    
    return new Response('OK', { status: 200 })
    
  } catch (error) {
    return new Response(error.message, { status: 400 })
  }
})
```

**Tasks**:
- [ ] Implement webhook parsing
- [ ] Implement signature verification
- [ ] Update transaction status
- [ ] Update subscription on success
- [ ] Trigger invoice generation
- [ ] Test with DUITKU simulator

### 2.3 Other Edge Functions

**Files to create**:
- `verify-payment/index.ts` - Manual payment verification
- `generate-invoice/index.ts` - PDF invoice generation
- `cancel-subscription/index.ts` - Subscription cancellation

**Tasks**:
- [ ] Implement verify-payment function
- [ ] Implement generate-invoice function (jsPDF)
- [ ] Implement cancel-subscription function
- [ ] Deploy all functions
- [ ] Test each function

---

## Phase 3: Types & Services

**Duration**: 1 day

### 3.1 TypeScript Types

**File**: `src/types/subscription.ts`

```typescript
export interface Subscription {
  id: string;
  master_user_id: string;
  plan_type: 'free' | 'basic' | 'pro';
  status: 'active' | 'expired' | 'cancelled' | 'pending';
  quota_limit: number;
  quota_used: number;
  billing_cycle: 'monthly' | 'yearly';
  valid_from: string;
  valid_until: string;
  next_billing_date?: string;
  auto_renew: boolean;
  price: number;
  scheduled_downgrade_to?: string;
  scheduled_downgrade_date?: string;
  grace_period_ends_at?: string;
}

export interface PricingPlan {
  id: string;
  plan_type: 'free' | 'basic' | 'pro';
  plan_name: string;
  billing_cycle: 'monthly' | 'yearly';
  price: number;
  quota: number; // -1 for unlimited
  features: string[];
  discount_percentage: number;
}
```

**File**: `src/types/payment.ts`

```typescript
export interface PaymentTransaction {
  id: string;
  user_id: string;
  transaction_id: string;
  merchant_order_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  payment_provider?: string;
  status: 'pending' | 'success' | 'failed' | 'expired';
  plan_purchased: string;
  invoice_number?: string;
  invoice_pdf_url?: string;
  paid_at?: string;
  created_at: string;
}

export interface RefundRequest {
  id: string;
  transaction_id: string;
  refund_number: string;
  reason: string;
  details: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'transferred';
  created_at: string;
}
```

**Tasks**:
- [ ] Create all type files
- [ ] Export from index
- [ ] Verify no TypeScript errors

### 3.2 Services

**File**: `src/lib/services/SubscriptionService.ts`

```typescript
export class SubscriptionService {
  async getCurrentSubscription(): Promise<Subscription> {
    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('master_user_id', userId)
      .single()
    return data
  }
  
  async upgradePlan(planId: string, billingCycle: string) {
    const { data } = await supabase.functions.invoke('create-payment', {
      body: { plan_id: planId, payment_method: 'bank_transfer' }
    })
    return data
  }
  
  // ... other methods
}
```

**Tasks**:
- [ ] Implement SubscriptionService
- [ ] Implement PaymentService
- [ ] Implement SettingsService
- [ ] Add error handling
- [ ] Write unit tests

### 3.3 React Hooks

**File**: `src/lib/hooks/useSubscription.ts`

```typescript
export function useSubscription() {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    // Fetch subscription
    // Subscribe to realtime updates
  }, [])
  
  return { subscription, loading, refetch }
}
```

**Tasks**:
- [ ] Create useSubscription hook
- [ ] Create usePayment hook
- [ ] Create useSettings hook
- [ ] Add Realtime subscriptions
- [ ] Test hooks

---

## Phase 4: UI Components - Payment & Subscription Tab

**Duration**: 3-4 days  
**Directory**: `src/components/settings/`

### 4.1 Settings Page Container

**File**: `src/components/pages/SettingsPage.tsx`

**Structure**:
```tsx
export function SettingsPage() {
  const [activeTab, setActiveTab] = useState('whatsapp-session')
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <aside className="lg:col-span-1">
            <SettingsSidebar activeTab={activeTab} onTabChange={setActiveTab} />
          </aside>
          
          {/* Content Area */}
          <main className="lg:col-span-3">
            {activeTab === 'whatsapp-session' && <WhatsAppSessionTab />}
            {activeTab === 'payment' && <PaymentSubscriptionTab />}
            {activeTab === 'account' && <AccountProfileTab />}
            {/* ... other tabs */}
          </main>
        </div>
      </div>
    </div>
  )
}
```

**Tasks**:
- [ ] Create SettingsPage.tsx with sidebar + content layout
- [ ] Implement responsive grid (mobile: stack, desktop: sidebar)
- [ ] Add tab state management
- [ ] Style with shadcn Card components
- [ ] Add page header with title

---

### 4.2 Settings Sidebar Navigation

**File**: `src/components/settings/SettingsSidebar.tsx`

**Features**:
- Tab list with icons
- Active tab highlight
- Locked badge for Team Management
- Responsive (collapse on mobile)

**Code Structure**:
```tsx
const tabs = [
  { id: 'whatsapp-session', label: 'WhatsApp Session', icon: MessageSquare },
  { id: 'payment', label: 'Payment & Subscription', icon: CreditCard },
  { id: 'account', label: 'Account & Profile', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'messages', label: 'Message Settings', icon: Settings },
  { id: 'sync', label: 'Database & Sync', icon: RefreshCw },
  { id: 'security', label: 'Security & Privacy', icon: Shield },
  { id: 'team', label: 'Team Management', icon: Users, locked: true },
  { id: 'advanced', label: 'Advanced', icon: Wrench }
]
```

**Tasks**:
- [ ] Create sidebar component
- [ ] Map tabs with icons
- [ ] Add active state styling
- [ ] Add locked badge (🔒) for Team tab
- [ ] Make responsive (hamburger on mobile)

---

### 4.3 Current Subscription Card

**File**: `src/components/settings/subscription/CurrentPlanCard.tsx`

**UI Layout**:
```
┌─────────────────────────────────────────┐
│ 💎 Current Plan: PRO                    │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                         │
│ Quota Usage:  7,500 / ∞ messages        │ ← Show ∞ for Pro
│ [████████████████░░░░] 75%              │
│                                         │
│ Billing: Yearly (Save 20%)              │
│ Valid Until: Dec 21, 2025 (30 days)     │
│ Auto-Renew: [ON] ✓                      │
│                                         │
│ [Upgrade Plan] [Manage Subscription]    │
└─────────────────────────────────────────┘
```

**Code Structure**:
```tsx
export function CurrentPlanCard() {
  const { subscription, loading } = useSubscription()
  
  const displayQuota = (quota: number) => {
    if (quota >= 999999 || quota === -1) return '∞'
    return quota.toLocaleString()
  }
  
  return (
    <AnimatedCard>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Current Plan</CardTitle>
          <Badge variant={getBadgeVariant(subscription.plan_type)}>
            {subscription.plan_type.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Quota Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Quota Usage:</span>
            <span>{subscription.quota_used} / {displayQuota(subscription.quota_limit)}</span>
          </div>
          <Progress value={calculatePercentage()} />
        </div>
        
        {/* Billing Info */}
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Billing:</span>
            <span>{subscription.billing_cycle} {subscription.discount && `(Save ${subscription.discount}%)`}</span>
          </div>
          <div className="flex justify-between">
            <span>Valid Until:</span>
            <span>{formatDate(subscription.valid_until)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Auto-Renew:</span>
            <Switch checked={subscription.auto_renew} onCheckedChange={handleToggleAutoRenew} />
          </div>
        </div>
        
        {/* Actions */}
        <div className="mt-6 flex gap-2">
          <Button onClick={openUpgradeModal}>Upgrade Plan</Button>
          <Button variant="outline" onClick={openManageModal}>Manage</Button>
        </div>
      </CardContent>
    </AnimatedCard>
  )
}
```

**Tasks**:
- [ ] Create component with useSubscription hook
- [ ] Implement quota display (∞ for Pro)
- [ ] Add Progress bar (shadcn Progress)
- [ ] Add auto-renew toggle (shadcn Switch)
- [ ] Add upgrade/manage buttons
- [ ] Handle loading state (skeleton)
- [ ] Add countdown for expiry date
- [ ] Style plan badge (Free=gray, Basic=blue, Pro=purple)

---

### 4.4 Pricing Plans Comparison

**File**: `src/components/settings/subscription/PricingPlans.tsx`

**UI Layout**:
```
┌──────────────────────────────────────────────────────┐
│ Choose Your Plan                                     │
│ [Monthly] / [Yearly] ← Save 20%!                    │
│                                                      │
│ ┌──────┐  ┌──────┐  ┌──────┐                       │
│ │ FREE │  │BASIC │  │ PRO  │                       │
│ │      │  │⭐    │  │💎BEST│                       │
│ │  Rp  │  │  Rp  │  │  Rp  │                       │
│ │  0   │  │ 50K  │  │ 75K  │                       │
│ │/month│  │/month│  │/month│                       │
│ │      │  │      │  │      │                       │
│ │  5   │  │ 500  │  │  ∞   │ ← Infinity symbol     │
│ │ msg  │  │ msg  │  │ msg  │                       │
│ │      │  │      │  │      │                       │
│ │[Use] │  │[Buy] │  │[Buy] │                       │
│ └──────┘  └──────┘  └──────┘                       │
│           Save 120K! Save 180K! (if yearly)         │
└──────────────────────────────────────────────────────┘
```

**Code Structure**:
```tsx
export function PricingPlans() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const { data: plans } = usePricingPlans()
  const { subscription } = useSubscription()
  
  const filteredPlans = plans.filter(p => p.billing_cycle === billingCycle)
  
  return (
    <div className="space-y-6">
      {/* Billing Cycle Toggle */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-lg border p-1">
          <Button
            variant={billingCycle === 'monthly' ? 'default' : 'ghost'}
            onClick={() => setBillingCycle('monthly')}
          >
            Monthly
          </Button>
          <Button
            variant={billingCycle === 'yearly' ? 'default' : 'ghost'}
            onClick={() => setBillingCycle('yearly')}
          >
            Yearly
            {billingCycle === 'yearly' && <Badge className="ml-2">Save 20%</Badge>}
          </Button>
        </div>
      </div>
      
      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {filteredPlans.map(plan => (
          <PricingCard
            key={plan.id}
            plan={plan}
            isCurrentPlan={plan.plan_type === subscription.plan_type}
            onSelect={() => handleSelectPlan(plan)}
          />
        ))}
      </div>
    </div>
  )
}

function PricingCard({ plan, isCurrentPlan, onSelect }) {
  const displayQuota = plan.quota >= 999999 || plan.quota === -1 ? '∞' : plan.quota
  
  return (
    <Card className={cn(
      "relative",
      plan.plan_type === 'pro' && "border-purple-500 shadow-lg"
    )}>
      {plan.plan_type === 'pro' && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-purple-500">BEST VALUE</Badge>
        </div>
      )}
      
      <CardHeader>
        <CardTitle className="text-center">
          {plan.plan_name.split(' - ')[0]}
        </CardTitle>
        <div className="text-center">
          <span className="text-3xl font-bold">
            {formatCurrency(plan.price)}
          </span>
          <span className="text-sm text-muted-foreground">
            /{plan.billing_cycle}
          </span>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="text-center mb-4">
          <span className="text-2xl font-bold">{displayQuota}</span>
          <span className="text-sm"> messages/month</span>
        </div>
        
        {/* Features List */}
        <ul className="space-y-2 mb-6">
          {plan.features.map((feature, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <Check className="h-4 w-4 text-green-500 mt-0.5" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        
        {/* CTA Button */}
        <Button
          className="w-full"
          variant={isCurrentPlan ? 'outline' : 'default'}
          disabled={isCurrentPlan}
          onClick={onSelect}
        >
          {isCurrentPlan ? 'Current Plan' : 'Select Plan'}
        </Button>
        
        {plan.discount_percentage > 0 && (
          <p className="text-center text-sm text-green-600 mt-2">
            Save Rp {calculateSavings(plan)}K/year
          </p>
        )}
      </CardContent>
    </Card>
  )
}
```

**Tasks**:
- [ ] Create PricingPlans component
- [ ] Add billing cycle toggle (Monthly/Yearly)
- [ ] Create PricingCard sub-component
- [ ] Display ∞ for Pro plan quota
- [ ] Add "BEST VALUE" badge for Pro
- [ ] Show savings for yearly plans
- [ ] Highlight current plan
- [ ] Add select plan handler
- [ ] Make responsive (stack on mobile)

---

### 4.5 Payment Method Modal

**File**: `src/components/settings/subscription/PaymentMethodModal.tsx`

**UI Flow**:
1. Select payment method (Bank Transfer, E-Wallet, QRIS, CC)
2. Show payment instructions (QR Code / VA Number)
3. Poll payment status
4. Show success/failure

**Code Structure**:
```tsx
export function PaymentMethodModal({ isOpen, onClose, planId }) {
  const [step, setStep] = useState<'select' | 'instructions' | 'processing'>('select')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [paymentData, setPaymentData] = useState(null)
  
  const handleCreatePayment = async () => {
    const { data } = await supabase.functions.invoke('create-payment', {
      body: { plan_id: planId, payment_method: paymentMethod }
    })
    setPaymentData(data)
    setStep('instructions')
    startPolling(data.transaction_id)
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        {step === 'select' && (
          <PaymentMethodSelection
            selected={paymentMethod}
            onSelect={setPaymentMethod}
            onContinue={handleCreatePayment}
          />
        )}
        
        {step === 'instructions' && (
          <PaymentInstructions
            paymentData={paymentData}
            method={paymentMethod}
          />
        )}
        
        {step === 'processing' && (
          <PaymentProcessing />
        )}
      </DialogContent>
    </Dialog>
  )
}

function PaymentMethodSelection({ selected, onSelect, onContinue }) {
  const methods = [
    { id: 'bank_transfer', name: 'Bank Transfer', icon: Building2, providers: ['BCA', 'Mandiri', 'BNI', 'BRI'] },
    { id: 'e_wallet', name: 'E-Wallet', icon: Wallet, providers: ['GoPay', 'OVO', 'DANA', 'ShopeePay'] },
    { id: 'qris', name: 'QRIS', icon: QrCode },
    { id: 'credit_card', name: 'Credit Card', icon: CreditCard }
  ]
  
  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>Select Payment Method</DialogTitle>
      </DialogHeader>
      
      <RadioGroup value={selected} onValueChange={onSelect}>
        {methods.map(method => (
          <div key={method.id} className="flex items-center space-x-2 border rounded-lg p-4">
            <RadioGroupItem value={method.id} id={method.id} />
            <Label htmlFor={method.id} className="flex items-center gap-3 cursor-pointer flex-1">
              <method.icon className="h-5 w-5" />
              <div>
                <p className="font-medium">{method.name}</p>
                {method.providers && (
                  <p className="text-xs text-muted-foreground">
                    {method.providers.join(', ')}
                  </p>
                )}
              </div>
            </Label>
          </div>
        ))}
      </RadioGroup>
      
      <Button onClick={onContinue} disabled={!selected} className="w-full">
        Continue
      </Button>
    </div>
  )
}

function PaymentInstructions({ paymentData, method }) {
  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>Payment Instructions</DialogTitle>
      </DialogHeader>
      
      {method === 'qris' && paymentData.duitku_qr_string && (
        <div className="flex flex-col items-center space-y-4">
          <QRCodeSVG value={paymentData.duitku_qr_string} size={256} />
          <p className="text-sm text-center">Scan QR Code with your e-wallet app</p>
        </div>
      )}
      
      {method === 'bank_transfer' && paymentData.duitku_va_number && (
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm font-medium mb-2">Virtual Account Number:</p>
            <div className="flex items-center justify-between">
              <code className="text-lg font-mono">{paymentData.duitku_va_number}</code>
              <Button size="sm" variant="outline" onClick={() => copyToClipboard(paymentData.duitku_va_number)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Alert>
            <AlertDescription>
              Transfer exactly <strong>{formatCurrency(paymentData.amount)}</strong> to the VA number above
            </AlertDescription>
          </Alert>
        </div>
      )}
      
      {/* Payment Expiry Countdown */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Payment expires in: <CountdownTimer expiry={paymentData.expired_at} />
        </p>
      </div>
      
      {/* Status Polling Indicator */}
      <div className="flex items-center justify-center gap-2 text-sm">
        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
        <span>Waiting for payment...</span>
      </div>
    </div>
  )
}
```

**Tasks**:
- [ ] Create modal component with Dialog (shadcn)
- [ ] Implement payment method selection
- [ ] Add QR Code display (qrcode.react)
- [ ] Add VA number display with copy button
- [ ] Implement payment status polling (every 5s)
- [ ] Add countdown timer for expiry
- [ ] Handle payment success (close modal, refresh subscription)
- [ ] Handle payment failure (show error, retry option)
- [ ] Add loading states

---

### 4.6 Payment History Table

**File**: `src/components/settings/subscription/PaymentHistoryTable.tsx`

**UI Layout**:
```
┌────────────────────────────────────────────────────────┐
│ Payment History                                        │
│ [Filter: All ▼] [Search...]                           │
│                                                        │
│ Date       | Amount    | Method  | Plan  | Status     │
│ ──────────────────────────────────────────────────── │
│ 2025-11-21 | Rp 299K   | GoPay   | Pro   | ✓ Success  │
│ 2025-10-21 | Rp 299K   | BCA VA  | Pro   | ✓ Success  │
│ 2025-09-21 | Rp 99K    | QRIS    | Basic | ✗ Failed   │
│                                                        │
│ [← Previous] Page 1 of 3 [Next →]                     │
└────────────────────────────────────────────────────────┘
```

**Code Structure**:
```tsx
export function PaymentHistoryTable() {
  const [filter, setFilter] = useState<'all' | 'success' | 'pending' | 'failed'>('all')
  const [page, setPage] = useState(1)
  const { data: transactions, loading } = usePaymentHistory({ filter, page })
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Payment History</CardTitle>
          <div className="flex gap-2">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Invoice</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map(tx => (
              <TableRow key={tx.id}>
                <TableCell>{formatDate(tx.created_at)}</TableCell>
                <TableCell>{formatCurrency(tx.amount)}</TableCell>
                <TableCell>{tx.payment_method}</TableCell>
                <TableCell>{tx.plan_purchased}</TableCell>
                <TableCell>
                  <Badge variant={getStatusVariant(tx.status)}>
                    {tx.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {tx.invoice_pdf_url && (
                    <Button size="sm" variant="ghost" onClick={() => downloadInvoice(tx.id)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        {/* Pagination */}
        <div className="flex items-center justify-between mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => p - 1)}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="text-sm">Page {page}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => p + 1)}
            disabled={transactions.length < 10}
          >
            Next
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

**Tasks**:
- [ ] Create table component (shadcn Table)
- [ ] Add filter dropdown (All/Success/Pending/Failed)
- [ ] Implement pagination
- [ ] Add status badges with colors
- [ ] Add download invoice button
- [ ] Handle empty state
- [ ] Add loading skeleton
- [ ] Format dates and currency

---

**Continue to Phase 5 for other Settings tabs...**

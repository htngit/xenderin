# Settings Page - Complete Implementation Plan

> **Project**: Xender-In WhatsApp Automation  
> **Feature**: Complete Settings Page with Payment & Subscription  
> **Version**: 2.0 - Complete Edition
> **Last Updated**: 2025-11-22

---

## 🎉 **DUITKU INTEGRATION STATUS** (Updated: 2025-11-22)

### ✅ **PHASE 2A: CORE PAYMENT FUNCTIONS - COMPLETE**

**Edge Function: `create-payment` (v9)**
- ✅ Deployed and fully functional
- ✅ MD5 signature generation fixed (was "Wrong signature" → now valid)
- ✅ Supports all payment methods: VA (BC, M2, BR) + E-Wallet (OV, DA, LA)
- ✅ Special handling for OVO LINK (OL) with `accountLink` object
- ✅ Dynamic `return_url` from frontend
- ✅ Supabase Secrets configured

**Payment UI - COMPLETE**
- ✅ `PaymentMethodModal.tsx` - 6 payment methods ready
- ✅ `PaymentTab.tsx` - Full integration with modal
- ✅ `PaymentService.ts` - Service layer working
- ✅ Error handling and loading states

**Database - COMPLETE**
- ✅ `payment_transactions` table
- ✅ `pricing_plans` table with Free/Basic/Pro
- ✅ RLS policies configured

### ⚠️ **CURRENT BLOCKER: SANDBOX LIMITATION**
- Sandbox merchant only has OVO LINK (OL) available
- OVO LINK requires valid `credentialCode` (not available in Sandbox)
- **Solution**: Upgrade to Production DUITKU account

### 📋 **REMAINING WORK**

**Phase 2B: Webhook Handler** (Not Started)
- [ ] `payment-webhook` Edge Function
- [ ] Signature verification
- [ ] Subscription update logic
- [ ] Transaction status update

**Phase 2C: Additional Functions** (Not Started)
- [ ] `verify-payment` Edge Function
- [ ] `cancel-payment` Edge Function (optional)

### 🚀 **PRODUCTION READINESS**
- ✅ Code is Production-ready
- ✅ All payment methods configured
- ⏳ Waiting for Production DUITKU credentials
- ⏳ Webhook handler implementation needed

---

## 🎯 **CHECKPOINT PRIORITIES**

### **🔴 CRITICAL - MVP (Must Have)**
**Target: Week 1-2 (10-12 days)**

- ✅ Phase 1: Database Schema (1 day)
- ✅ Phase 2: Edge Functions - Payment only (2 days)
- ✅ Phase 3: Types & Services - Core only (1 day)
- ✅ Phase 4A: Payment Tab - Current Plan + Pricing + Payment Modal (3 days)
- ✅ Phase 6A: Basic Integration (1 day)
- ✅ Phase 7A: Critical Testing (1 day)

**Deliverable**: User can view subscription, upgrade/downgrade, and make payment.

---

### **🟡 HIGH - Enhanced (Should Have)**
**Target: Week 3 (5-7 days)**

- ✅ Phase 4B: Payment Tab - History + Billing Info (2 days)
- ✅ Phase 5A: Account Profile Tab (1 day)
- ✅ Phase 5B: WhatsApp Session Tab (placeholder) (1 day)
- ✅ Phase 6B: Full Integration + Polish (2 days)

**Deliverable**: Complete payment management + basic account settings.

---

### **🟢 MEDIUM - Nice to Have**
**Target: Week 4 (3-5 days)**

- ✅ Phase 5C: Other Settings Tabs (Notifications, Messages, Sync) (2 days)
- ✅ Phase 5D: Team Management (Locked UI) (1 day)
- ✅ Phase 7B: Comprehensive Testing (2 days)

**Deliverable**: All settings tabs functional.

---

### **🔵 LOW - Future Enhancement**
**Target: Post-MVP**

- ⏸️ Refund automation
- ⏸️ Advanced analytics
- ⏸️ Team Management functional (CRM phase)
- ⏸️ 2FA implementation

---

## 📋 **Table of Contents**

1. [Phase 1: Database Schema](#phase-1-database-schema) 🔴 CRITICAL
2. [Phase 2: Edge Functions](#phase-2-edge-functions) 🔴 CRITICAL
3. [Phase 3: Types & Services](#phase-3-types--services) 🔴 CRITICAL
4. [Phase 4: UI - Payment Tab](#phase-4-ui-payment-tab) 🔴 CRITICAL
5. [Phase 5: UI - Other Tabs](#phase-5-ui-other-tabs) 🟡 HIGH
6. [Phase 6: Integration & Polish](#phase-6-integration--polish) 🟡 HIGH
7. [Phase 7: Testing](#phase-7-testing) 🔴 CRITICAL
8. [Phase 8: Deployment](#phase-8-deployment) 🔴 CRITICAL
9. [Helper Functions](#helper-functions) 🔴 CRITICAL
10. [Implementation Rules](#implementation-rules)

---

## Phase 1: Database Schema 🔴 CRITICAL

**Duration**: 1 day  
**Priority**: CRITICAL - Must complete first  
**File**: `supabase/migrations/20251121_settings_schema.sql`

> **⚠️ ZERO BREAKING CHANGES (With 1 Exception)**  
> - ❌ NO ALTER existing tables (Exception: `user_quotas` CHECK constraint must be updated for new plan types)
> - ✅ Only CREATE new tables
> - ✅ Sync via triggers

### Checkpoint: Phase 1 Complete When:
- [ ] All 6 new tables created
- [ ] Sync trigger working (test: update subscription → user_quotas auto-updates)
- [ ] Default free subscriptions created for existing users
- [ ] Existing code still works (verify SendPage)

[See full Phase 1 details in Settings_Plan.md]

---

## Phase 2: Edge Functions 🔴 CRITICAL

**Duration**: 2-3 days  
**Priority**: CRITICAL for payment flow

### 🔴 **2A: Core Payment Functions (CRITICAL - Day 1-2)**

#### create-payment
- [ ] User authentication
- [ ] DUITKU API integration
- [ ] Transaction creation
- [ ] Test with Postman

#### payment-webhook
- [ ] Signature verification
- [ ] Subscription update
- [ ] Invoice trigger
- [ ] Test with DUITKU simulator

### 🟡 **2B: Supporting Functions (HIGH - Day 3)**

#### verify-payment
- [ ] Manual status check
- [ ] Frontend polling support

#### generate-invoice
- [ ] PDF generation (jsPDF)
- [ ] Upload to Storage
- [ ] Email notification (optional)

### Checkpoint: Phase 2 Complete When:
- [ ] Can create payment via API
- [ ] Webhook updates subscription correctly
- [ ] Invoice generated and downloadable

---

## Phase 3: Types & Services 🔴 CRITICAL

**Duration**: 1 day  
**Priority**: CRITICAL - Foundation for UI

### 🔴 **3A: Core Types (CRITICAL - Morning)**

**File**: `src/types/subscription.ts`
```typescript
export interface Subscription {
  id: string
  master_user_id: string
  plan_type: 'free' | 'basic' | 'pro'
  status: 'active' | 'expired' | 'cancelled'
  quota_limit: number
  quota_used: number
  billing_cycle: 'monthly' | 'yearly'
  valid_until: string
  auto_renew: boolean
  price: number
}

export interface PricingPlan {
  id: string
  plan_type: 'free' | 'basic' | 'pro'
  plan_name: string
  billing_cycle: 'monthly' | 'yearly'
  price: number
  quota: number // -1 or 999999 for unlimited
  features: string[]
  discount_percentage: number
}
```

**File**: `src/types/payment.ts`
```typescript
export interface PaymentTransaction {
  id: string
  user_id: string
  transaction_id: string
  amount: number
  payment_method: string
  status: 'pending' | 'success' | 'failed' | 'expired'
  plan_purchased: string
  invoice_pdf_url?: string
  created_at: string
}
```

### 🔴 **3B: Core Services (CRITICAL - Afternoon)**

**File**: `src/lib/services/SubscriptionService.ts`
```typescript
export class SubscriptionService {
  async getCurrentSubscription(userId: string): Promise<Subscription> {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('master_user_id', userId)
      .single()
    
    if (error) throw error
    return data
  }
  
  async getPricingPlans(): Promise<PricingPlan[]> {
    const { data, error } = await supabase
      .from('pricing_plans')
      .select('*')
      .eq('is_active', true)
      .order('price')
    
    if (error) throw error
    return data
  }
}
```

**File**: `src/lib/services/PaymentService.ts`
```typescript
export class PaymentService {
  async createPayment(planId: string, paymentMethod: string) {
    const { data, error } = await supabase.functions.invoke('create-payment', {
      body: { plan_id: planId, payment_method: paymentMethod }
    })
    
    if (error) throw error
    return data
  }
  
  async getPaymentHistory(userId: string) {
    const { data, error } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (error) throw error
    return data
  }
}
```

### 🔴 **3C: React Hooks (CRITICAL)**

**File**: `src/lib/hooks/useSubscription.ts`
```typescript
export function useSubscription() {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const userId = await userContextManager.getCurrentMasterUserId()
        const service = new SubscriptionService()
        const data = await service.getCurrentSubscription(userId)
        setSubscription(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    
    fetchSubscription()
    
    // Realtime subscription
    const channel = supabase
      .channel('subscription-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'subscriptions',
        filter: `master_user_id=eq.${userId}`
      }, (payload) => {
        setSubscription(payload.new as Subscription)
      })
      .subscribe()
    
    return () => { channel.unsubscribe() }
  }, [])
  
  return { subscription, loading, error, refetch: fetchSubscription }
}
```

### Checkpoint: Phase 3 Complete When:
- [ ] All types defined and exported
- [ ] Services tested with real Supabase data
- [ ] Hooks return data correctly
- [ ] No TypeScript errors

---

## Phase 4: UI - Payment Tab 🔴 CRITICAL

**Duration**: 3-4 days  
**Priority**: CRITICAL - Core user flow

### 🔴 **4A: MVP Components (CRITICAL - Day 1-2)**

#### 4A.1 Settings Page Container
**File**: `src/components/pages/SettingsPage.tsx`

```typescript
export function SettingsPage() {
  const [activeTab, setActiveTab] = useState('payment')
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Settings</h1>
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="payment">Payment & Subscription</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
            {/* Other tabs */}
          </TabsList>
          
          <TabsContent value="payment">
            <PaymentSubscriptionTab />
          </TabsContent>
          
          <TabsContent value="account">
            <AccountProfileTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
```

**Tasks**:
- [ ] Create page with Tabs (shadcn)
- [ ] Add responsive layout
- [ ] Test tab switching

#### 4A.2 Current Plan Card
**File**: `src/components/settings/subscription/CurrentPlanCard.tsx`

```typescript
export function CurrentPlanCard() {
  const { subscription, loading } = useSubscription()
  
  if (loading) return <Skeleton className="h-64" />
  if (!subscription) return <Alert>No subscription found</Alert>
  
  const displayQuota = (quota: number) => {
    if (quota >= 999999 || quota === -1) return '∞'
    return quota.toLocaleString()
  }
  
  const quotaPercentage = subscription.plan_type === 'pro' 
    ? 0 
    : (subscription.quota_used / subscription.quota_limit) * 100
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Current Plan</CardTitle>
          <Badge variant={
            subscription.plan_type === 'pro' ? 'default' :
            subscription.plan_type === 'basic' ? 'secondary' : 'outline'
          }>
            {subscription.plan_type.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Quota Display */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span>Quota Usage:</span>
            <span className="font-medium">
              {subscription.quota_used.toLocaleString()} / {displayQuota(subscription.quota_limit)}
            </span>
          </div>
          {subscription.plan_type !== 'pro' && (
            <Progress value={quotaPercentage} />
          )}
        </div>
        
        {/* Billing Info */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Billing:</span>
            <span>{subscription.billing_cycle}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Valid Until:</span>
            <span>{format(new Date(subscription.valid_until), 'PPP')}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Auto-Renew:</span>
            <Switch 
              checked={subscription.auto_renew} 
              onCheckedChange={handleToggleAutoRenew}
            />
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex gap-2 pt-4">
          {subscription.plan_type !== 'pro' && (
            <Button onClick={() => setShowUpgradeModal(true)} className="flex-1">
              Upgrade Plan
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowManageModal(true)}>
            Manage
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

**Tasks**:
- [ ] Display quota with ∞ for Pro
- [ ] Add Progress bar (hide for Pro)
- [ ] Add auto-renew toggle
- [ ] Add upgrade button
- [ ] Handle loading state

#### 4A.3 Pricing Plans
**File**: `src/components/settings/subscription/PricingPlans.tsx`

```typescript
export function PricingPlans() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const { data: plans } = usePricingPlans()
  const { subscription } = useSubscription()
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  
  const filteredPlans = plans?.filter(p => 
    p.billing_cycle === billingCycle || p.plan_type === 'free'
  ) || []
  
  const handleSelectPlan = (plan: PricingPlan) => {
    if (plan.plan_type === subscription?.plan_type) return
    setSelectedPlan(plan)
    setShowPaymentModal(true)
  }
  
  return (
    <div className="space-y-6">
      {/* Billing Toggle */}
      <div className="flex justify-center">
        <div className="inline-flex items-center rounded-lg border p-1 bg-muted">
          <Button
            variant={billingCycle === 'monthly' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setBillingCycle('monthly')}
          >
            Monthly
          </Button>
          <Button
            variant={billingCycle === 'yearly' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setBillingCycle('yearly')}
          >
            Yearly
            <Badge variant="secondary" className="ml-2">Save 20%</Badge>
          </Button>
        </div>
      </div>
      
      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {filteredPlans.map(plan => (
          <PricingCard
            key={plan.id}
            plan={plan}
            isCurrentPlan={plan.plan_type === subscription?.plan_type}
            onSelect={() => handleSelectPlan(plan)}
          />
        ))}
      </div>
      
      {/* Payment Modal */}
      {selectedPlan && (
        <PaymentMethodModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          plan={selectedPlan}
        />
      )}
    </div>
  )
}

function PricingCard({ plan, isCurrentPlan, onSelect }: {
  plan: PricingPlan
  isCurrentPlan: boolean
  onSelect: () => void
}) {
  const displayQuota = plan.quota >= 999999 || plan.quota === -1 ? '∞' : plan.quota
  
  return (
    <Card className={cn(
      "relative transition-all hover:shadow-lg",
      plan.plan_type === 'pro' && "border-purple-500 shadow-md",
      isCurrentPlan && "ring-2 ring-primary"
    )}>
      {plan.plan_type === 'pro' && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-purple-600">BEST VALUE</Badge>
        </div>
      )}
      
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">
          {plan.plan_name.split(' - ')[0]}
        </CardTitle>
        <div className="mt-4">
          <span className="text-4xl font-bold">
            {plan.price === 0 ? 'Free' : `Rp ${(plan.price / 1000).toFixed(0)}K`}
          </span>
          {plan.price > 0 && (
            <span className="text-muted-foreground">
              /{plan.billing_cycle === 'yearly' ? 'year' : 'month'}
            </span>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Quota */}
        <div className="text-center py-4 bg-muted rounded-lg">
          <div className="text-3xl font-bold">{displayQuota}</div>
          <div className="text-sm text-muted-foreground">messages/month</div>
        </div>
        
        {/* Features */}
        <ul className="space-y-2">
          {plan.features.map((feature, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        
        {/* CTA */}
        <Button
          className="w-full"
          variant={isCurrentPlan ? 'outline' : 'default'}
          disabled={isCurrentPlan || plan.plan_type === 'free'}
          onClick={onSelect}
        >
          {isCurrentPlan ? 'Current Plan' : 
           plan.plan_type === 'free' ? 'Free' : 'Select Plan'}
        </Button>
        
        {plan.discount_percentage > 0 && (
          <p className="text-center text-sm text-green-600">
            Save Rp {((plan.price * 0.2) / 1000).toFixed(0)}K/year
          </p>
        )}
      </CardContent>
    </Card>
  )
}
```

**Tasks**:
- [ ] Billing cycle toggle
- [ ] Display ∞ for Pro quota
- [ ] BEST VALUE badge for Pro
- [ ] Highlight current plan
- [ ] Open payment modal on select

#### 4A.4 Payment Method Modal
**File**: `src/components/settings/subscription/PaymentMethodModal.tsx`

```typescript
export function PaymentMethodModal({ isOpen, onClose, plan }: {
  isOpen: boolean
  onClose: () => void
  plan: PricingPlan
}) {
  const [step, setStep] = useState<'method' | 'instructions' | 'success'>('method')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [paymentData, setPaymentData] = useState<any>(null)
  const [polling, setPolling] = useState(false)
  
  const handleCreatePayment = async () => {
    try {
      const service = new PaymentService()
      const data = await service.createPayment(plan.id, paymentMethod)
      setPaymentData(data)
      setStep('instructions')
      startPolling(data.transaction_id)
    } catch (error) {
      toast.error('Failed to create payment')
    }
  }
  
  const startPolling = (transactionId: string) => {
    setPolling(true)
    const interval = setInterval(async () => {
      const service = new PaymentService()
      const status = await service.verifyPayment(transactionId)
      
      if (status === 'success') {
        clearInterval(interval)
        setStep('success')
        setPolling(false)
        toast.success('Payment successful!')
        setTimeout(() => {
          onClose()
          window.location.reload() // Refresh to show new subscription
        }, 2000)
      } else if (status === 'failed' || status === 'expired') {
        clearInterval(interval)
        setPolling(false)
        toast.error('Payment failed')
      }
    }, 5000) // Poll every 5 seconds
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        {step === 'method' && (
          <PaymentMethodSelection
            plan={plan}
            selected={paymentMethod}
            onSelect={setPaymentMethod}
            onContinue={handleCreatePayment}
          />
        )}
        
        {step === 'instructions' && paymentData && (
          <PaymentInstructions
            paymentData={paymentData}
            method={paymentMethod}
            polling={polling}
          />
        )}
        
        {step === 'success' && (
          <div className="text-center py-8">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-2">Payment Successful!</h3>
            <p className="text-muted-foreground">Your subscription has been updated.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function PaymentMethodSelection({ plan, selected, onSelect, onContinue }: any) {
  const methods = [
    { id: 'qris', name: 'QRIS', icon: QrCode, desc: 'Scan with any e-wallet' },
    { id: 'bank_transfer', name: 'Bank Transfer', icon: Building2, desc: 'BCA, Mandiri, BNI, BRI' },
    { id: 'e_wallet', name: 'E-Wallet', icon: Wallet, desc: 'GoPay, OVO, DANA, ShopeePay' },
  ]
  
  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>Select Payment Method</DialogTitle>
        <DialogDescription>
          {plan.plan_name} - Rp {(plan.price / 1000).toFixed(0)}K
        </DialogDescription>
      </DialogHeader>
      
      <RadioGroup value={selected} onValueChange={onSelect}>
        {methods.map(method => (
          <div key={method.id} className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-muted">
            <RadioGroupItem value={method.id} id={method.id} />
            <Label htmlFor={method.id} className="flex items-center gap-3 cursor-pointer flex-1">
              <method.icon className="h-6 w-6" />
              <div>
                <p className="font-medium">{method.name}</p>
                <p className="text-xs text-muted-foreground">{method.desc}</p>
              </div>
            </Label>
          </div>
        ))}
      </RadioGroup>
      
      <Button onClick={onContinue} disabled={!selected} className="w-full">
        Continue to Payment
      </Button>
    </div>
  )
}

function PaymentInstructions({ paymentData, method, polling }: any) {
  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>Payment Instructions</DialogTitle>
      </DialogHeader>
      
      {method === 'qris' && paymentData.duitku_qr_string && (
        <div className="flex flex-col items-center space-y-4">
          <QRCodeSVG value={paymentData.duitku_qr_string} size={256} />
          <p className="text-sm text-center text-muted-foreground">
            Scan this QR code with your e-wallet app
          </p>
        </div>
      )}
      
      {method === 'bank_transfer' && paymentData.duitku_va_number && (
        <div className="space-y-4">
          <Alert>
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">Virtual Account Number:</p>
                <div className="flex items-center justify-between bg-muted p-3 rounded">
                  <code className="text-lg font-mono">{paymentData.duitku_va_number}</code>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(paymentData.duitku_va_number)
                      toast.success('Copied to clipboard')
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm">
                  Transfer exactly <strong>Rp {(paymentData.amount / 1000).toFixed(0)}K</strong>
                </p>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}
      
      {/* Polling Indicator */}
      {polling && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
          <span>Waiting for payment confirmation...</span>
        </div>
      )}
      
      {/* Expiry */}
      <p className="text-center text-sm text-muted-foreground">
        Payment expires in: <CountdownTimer expiry={paymentData.expired_at} />
      </p>
    </div>
  )
}
```

**Tasks**:
- [ ] Payment method selection
- [ ] QR Code display (install qrcode.react)
- [ ] VA number with copy button
- [ ] Payment status polling (5s interval)
- [ ] Success/failure handling

### Checkpoint: Phase 4A Complete When:
- [ ] Can view current subscription
- [ ] Can see pricing plans with ∞ for Pro
- [ ] Can select plan and open payment modal
- [ ] Can complete payment (test with DUITKU sandbox)
- [ ] Subscription updates after payment

---

## Helper Functions 🔴 CRITICAL

**File**: `src/lib/utils/helpers.ts`

```typescript
// Currency formatting
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount)
}

// Date formatting
export function formatDate(date: string | Date): string {
  return format(new Date(date), 'PPP', { locale: id })
}

// Quota display
export function displayQuota(quota: number): string {
  if (quota >= 999999 || quota === -1) return '∞'
  return quota.toLocaleString('id-ID')
}

// Percentage calculation
export function calculatePercentage(used: number, limit: number): number {
  if (limit <= 0 || limit >= 999999) return 0
  return Math.min((used / limit) * 100, 100)
}

// Copy to clipboard
export async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}
```

**File**: `src/components/ui/CountdownTimer.tsx`

```typescript
export function CountdownTimer({ expiry }: { expiry: string }) {
  const [timeLeft, setTimeLeft] = useState('')
  
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().getTime()
      const expiryTime = new Date(expiry).getTime()
      const distance = expiryTime - now
      
      if (distance < 0) {
        setTimeLeft('Expired')
        clearInterval(interval)
        return
      }
      
      const hours = Math.floor(distance / (1000 * 60 * 60))
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((distance % (1000 * 60)) / 1000)
      
      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`)
    }, 1000)
    
    return () => clearInterval(interval)
  }, [expiry])
  
  return <span className="font-mono">{timeLeft}</span>
}
```

---

## Environment Variables

**File**: `.env.local`

```env
# Supabase (already exists)
VITE_SUPABASE_URL=https://xasuqqebngantzaenmwq.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# DUITKU Sandbox
VITE_DUITKU_MERCHANT_CODE=your_sandbox_merchant_code
VITE_DUITKU_API_KEY=your_sandbox_api_key
VITE_DUITKU_CALLBACK_URL=https://your-domain.com/api/payment-webhook
VITE_DUITKU_RETURN_URL=https://your-domain.com/settings?payment=success

# Company Info (for invoices)
VITE_COMPANY_NAME=Xalesin
VITE_COMPANY_ADDRESS=Jakarta Selatan, Pasar Minggu, Jakarta
VITE_COMPANY_EMAIL=xalesincare@xalesin.id
```

---

## Dependencies to Install

```bash
# Payment & QR Code
npm install qrcode.react
npm install @types/qrcode.react -D

# Form & Validation
npm install react-hook-form @hookform/resolvers zod

# Date formatting
npm install date-fns

# Already installed (verify)
# - @supabase/supabase-js
# - lucide-react
# - tailwindcss
# - shadcn/ui components
```

---

## 🎯 **MVP COMPLETION CHECKLIST**

### Week 1 Target:
- [ ] Phase 1: Database migrated
- [ ] Phase 2A: Payment functions deployed
- [ ] Phase 3: Types & services working
- [ ] Phase 4A: Payment tab functional
- [ ] Can upgrade from Free to Basic/Pro
- [ ] Payment completes successfully

### Week 2 Target:
- [ ] Payment history visible
- [ ] Invoice downloadable
- [ ] Account settings working
- [ ] All critical bugs fixed

---

**Total MVP: ~10-12 days for fully functional payment system**

See `Settings_Plan.md` for complete Phase 5-8 details.

---

## 10. Implementation Rules & Policies

### Key Policies (Synced with Settings_Plan.md)

✅ **Quota Reset**: Every 1st of month at 00:00 WIB (GMT+7)  
✅ **No Prorated Charges**: Upgrade = immediate full charge, full quota  
✅ **Downgrade**: Effective next billing cycle  
✅ **Monthly → Yearly Switch**: Immediate charge, previous payment hangus  
✅ **Grace Period**: 3 days for failed payments  
✅ **Refund**: 14 days for service complaints, transfer to bank  
✅ **Rate Limit**: Warning only for >300 msg/hour  
✅ **New User**: Auto Free plan with 5 messages  
✅ **UI Display - Pro Plan**: Show infinity symbol (∞) for quota instead of numbers in ALL dashboard components (Dashboard, Send Page, Settings)

### Development Rules
1. **Strict Types**: Use defined interfaces (Subscription, PricingPlan) everywhere.
2. **No Hardcoding**: Use constants or API data for plan details.
3. **Safe Migration**: Always backup data before running migrations.
4. **Error Handling**: Handle all edge cases (network fail, payment pending, etc).


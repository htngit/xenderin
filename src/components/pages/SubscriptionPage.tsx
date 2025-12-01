import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AnimatedButton } from '@/components/ui/animated-button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { serviceManager } from '@/lib/services';
import { SubscriptionPlan, PaymentSession } from '@/lib/services/types';
import { Check, CreditCard, AlertCircle } from 'lucide-react';

const PLAN_CONFIG = {
  basic: {
    name: 'Basic',
    price: 0,
    messages_limit: 500,
    features: ['500 messages/month', 'Basic templates', 'Email support'],
    popular: false
  },
  premium: {
    name: 'Premium',
    price: 99000, // IDR 99,000
    messages_limit: 1500,
    features: ['1,500 messages/month', 'Advanced templates', 'Priority support', 'Contact groups'],
    popular: true
  },
  enterprise: {
    name: 'Enterprise',
    price: 299000, // IDR 299,000
    messages_limit: 5000,
    features: ['5,000 messages/month', 'Custom templates', '24/7 support', 'API access', 'Analytics'],
    popular: false
  }
};

export const SubscriptionPage: React.FC = () => {
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentSession, setPaymentSession] = useState<PaymentSession | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<SubscriptionPlan>('basic');
  const [quotaUsage, setQuotaUsage] = useState({ used: 0, limit: 500 });
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'completed' | 'failed' | 'expired'>('pending');

  const { toast } = useToast();
  const paymentService = serviceManager.getPaymentService();
  const authService = serviceManager.getAuthService();
  const paymentSubscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);

  // Initialize current user data
  useEffect(() => {
    initializeUserData();
  }, []);

  // Cleanup payment subscription on unmount
  useEffect(() => {
    return () => {
      if (paymentSubscriptionRef.current) {
        paymentSubscriptionRef.current.unsubscribe();
      }
    };
  }, []);

  // Cleanup subscription when payment modal closes
  useEffect(() => {
    if (!isPaymentModalOpen && paymentSubscriptionRef.current) {
      paymentSubscriptionRef.current.unsubscribe();
      paymentSubscriptionRef.current = null;
    }
  }, [isPaymentModalOpen]);

  const initializeUserData = async () => {
    try {
      const user = await authService.getCurrentUser();
      if (user) {
        // Get current plan and quota from user's quota data
        // This would typically come from your quota service
        setCurrentPlan('basic'); // Placeholder
        setQuotaUsage({ used: 125, limit: 500 }); // Placeholder
      }
    } catch (error) {
      console.error('Error initializing user data:', error);
    }
  };

  const handlePlanUpgrade = async (targetPlan: SubscriptionPlan) => {
    if (targetPlan === 'basic') return; // Can't downgrade to basic
    if (targetPlan === currentPlan) return; // Already on this plan

    setIsProcessing(true);
    try {
      const user = await authService.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Create payment using new PaymentService interface
      const paymentSession = await paymentService.createPayment(
        targetPlan,
        PLAN_CONFIG[targetPlan].price,
        user.id
      );

      setPaymentSession(paymentSession);
      setSelectedPlan(targetPlan);
      setPaymentStatus('pending');
      setIsPaymentModalOpen(true);

      // Subscribe to real-time payment updates
      paymentSubscriptionRef.current = await paymentService.subscribeToPaymentUpdates(
        paymentSession.paymentId,
        handlePaymentUpdate
      );

      toast({
        title: "Payment Session Created",
        description: "Scan the QR code with your e-wallet app to complete payment.",
      });
    } catch (error) {
      console.error('Payment creation failed:', error);
      toast({
        title: "Payment Error",
        description: "Failed to create payment session. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePaymentUpdate = (updatedSession: PaymentSession) => {
    setPaymentSession(updatedSession);
    setPaymentStatus(updatedSession.status);

    if (updatedSession.status === 'completed') {
      setIsPaymentModalOpen(false);
      setCurrentPlan(selectedPlan!);
      toast({
        title: "Payment Successful!",
        description: `Your subscription has been upgraded to ${PLAN_CONFIG[selectedPlan!].name} plan.`,
      });
      // Refresh user data
      initializeUserData();
      // Cleanup subscription
      if (paymentSubscriptionRef.current) {
        paymentSubscriptionRef.current.unsubscribe();
        paymentSubscriptionRef.current = null;
      }
    } else if (updatedSession.status === 'failed') {
      setIsPaymentModalOpen(false);
      toast({
        title: "Payment Failed",
        description: "Payment was not completed. Please try again.",
        variant: "destructive",
      });
      // Cleanup subscription
      if (paymentSubscriptionRef.current) {
        paymentSubscriptionRef.current.unsubscribe();
        paymentSubscriptionRef.current = null;
      }
    } else if (updatedSession.status === 'expired') {
      setIsPaymentModalOpen(false);
      toast({
        title: "Payment Expired",
        description: "Payment session has expired. Please try again.",
        variant: "destructive",
      });
      // Cleanup subscription
      if (paymentSubscriptionRef.current) {
        paymentSubscriptionRef.current.unsubscribe();
        paymentSubscriptionRef.current = null;
      }
    }
  };

  const cancelPayment = async () => {
    if (!paymentSession) return;

    try {
      const user = await authService.getCurrentUser();
      if (user) {
        await paymentService.cancelPayment(paymentSession.paymentId);
        setIsPaymentModalOpen(false);
        toast({
          title: "Payment Cancelled",
          description: "Payment session has been cancelled.",
        });
        // Cleanup subscription
        if (paymentSubscriptionRef.current) {
          paymentSubscriptionRef.current.unsubscribe();
          paymentSubscriptionRef.current = null;
        }
      }
    } catch (error) {
      console.error('Cancel payment failed:', error);
      toast({
        title: "Error",
        description: "Failed to cancel payment. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getUsagePercentage = (): number => {
    return Math.round((quotaUsage.used / quotaUsage.limit) * 100);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Choose Your Plan</h1>
        <p className="text-muted-foreground">
          Upgrade your subscription to unlock more features and higher message limits
        </p>
      </div>

      {/* Current Usage Card */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Current Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="font-medium">Current Plan: {PLAN_CONFIG[currentPlan].name}</span>
              <Badge variant={currentPlan === 'basic' ? 'secondary' : 'default'}>
                {PLAN_CONFIG[currentPlan].name}
              </Badge>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Messages Used</span>
                <span>{quotaUsage.used} / {quotaUsage.limit}</span>
              </div>
              <Progress value={getUsagePercentage()} className="h-2" />
              <div className="text-xs text-muted-foreground">
                {getUsagePercentage()}% of your monthly limit used
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subscription Plans */}
      <div className="grid md:grid-cols-3 gap-6">
        {Object.entries(PLAN_CONFIG).map(([plan, config]) => (
          <Card key={plan} className={`relative ${config.popular ? 'ring-2 ring-primary' : ''}`}>
            {config.popular && (
              <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-primary">
                Most Popular
              </Badge>
            )}
            <CardHeader>
              <CardTitle>{config.name}</CardTitle>
              <CardDescription>
                {config.price === 0 ? 'Free' : `Rp ${(config.price / 1000).toLocaleString('id-ID')}/month`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Messages per month:</div>
                  <div className="text-2xl font-bold">{config.messages_limit.toLocaleString()}</div>
                </div>
                <ul className="space-y-2">
                  {config.features.map((feature, index) => (
                    <li key={index} className="flex items-center text-sm">
                      <Check className="mr-2 h-4 w-4 text-green-600" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
            <CardFooter>
              <AnimatedButton
                className="w-full"
                variant={plan === 'basic' ? 'outline' : 'default'}
                onClick={() => handlePlanUpgrade(plan as SubscriptionPlan)}
                disabled={plan === 'basic' || plan === currentPlan || isProcessing}
              >
                {plan === currentPlan ? 'Current Plan' :
                  plan === 'basic' ? 'Free Plan' :
                    'Upgrade Now'}
              </AnimatedButton>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Payment Modal */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Complete Payment
            </DialogTitle>
          </DialogHeader>
          <div className="text-center space-y-4">
            {selectedPlan && (
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">
                  {PLAN_CONFIG[selectedPlan].name} Plan
                </h3>
                <div className="text-2xl font-bold text-primary">
                  Rp {(PLAN_CONFIG[selectedPlan].price / 1000).toLocaleString('id-ID')}
                </div>
                <div className="text-sm text-muted-foreground">
                  {PLAN_CONFIG[selectedPlan].messages_limit.toLocaleString()} messages/month
                </div>
              </div>
            )}

            {paymentSession?.qrUrl && paymentStatus === 'pending' && (
              <div className="space-y-4">
                <div className="border rounded-lg p-4 bg-gray-50">
                  <img
                    src={paymentSession.qrUrl}
                    alt="Payment QR Code"
                    className="mx-auto w-48 h-48"
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Scan this QR code with your e-wallet app
                  </p>
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <div className={`w-3 h-3 rounded-full ${(paymentStatus as string) === 'completed' ? 'bg-green-500' :
                        (paymentStatus as string) === 'failed' ? 'bg-red-500' :
                          (paymentStatus as string) === 'expired' ? 'bg-red-500' : 'bg-yellow-500'
                      }`} />
                    <span>
                      {(paymentStatus as string) === 'pending' ? 'Waiting for payment...' :
                        (paymentStatus as string) === 'completed' ? 'Payment Completed!' :
                          (paymentStatus as string) === 'failed' ? 'Payment Failed' :
                            (paymentStatus as string) === 'expired' ? 'Payment Expired' : 'Processing...'}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={cancelPayment}>
                    Cancel Payment
                  </Button>
                </div>
              </div>
            )}

            {paymentStatus === 'completed' && (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <Check className="h-5 w-5" />
                  <span className="font-medium">Payment Successful!</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Your subscription has been upgraded. The page will refresh to show your new plan.
                </p>
              </div>
            )}

            {paymentStatus === 'failed' && (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 text-red-600">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium">Payment Failed</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Payment was not completed. Please try again.
                </p>
                <Button
                  onClick={() => selectedPlan && handlePlanUpgrade(selectedPlan)}
                  className="w-full"
                >
                  Try Again
                </Button>
              </div>
            )}

            {paymentStatus === 'expired' && (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 text-red-600">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium">Payment Expired</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Payment session has expired. Please try again.
                </p>
                <Button
                  onClick={() => selectedPlan && handlePlanUpgrade(selectedPlan)}
                  className="w-full"
                >
                  Create New Payment
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
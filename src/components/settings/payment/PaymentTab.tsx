import { useState } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { usePayment } from '@/hooks/usePayment';
import { CurrentPlanCard } from './CurrentPlanCard';
import { PricingPlans } from './PricingPlans';
import { PaymentMethodModal } from './PaymentMethodModal';
import { BillingInformationForm } from './BillingInformationForm';
import { PricingPlan } from '@/types/subscription';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { toast } from 'sonner';

export function PaymentTab() {
    const { subscription, plans, history, quota, isLoading, refetchSubscription } = useSubscription();
    const { createPayment, isCreating } = usePayment();

    const [selectedPlan, setSelectedPlan] = useState<PricingPlan | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleSelectPlan = (plan: PricingPlan) => {
        setSelectedPlan(plan);
        setIsModalOpen(true);
    };

    const handleConfirmPayment = async (paymentMethod: string) => {
        if (!selectedPlan) return;

        try {
            const transaction = await createPayment({ planId: selectedPlan.id, paymentMethod });

            // Redirect to Duitku payment page
            if (transaction.duitku_payment_url) {
                window.open(transaction.duitku_payment_url, '_blank');
                toast.success('Payment initiated! Please complete the payment in the new window.');
                setIsModalOpen(false);

                // Optionally refetch subscription after a delay
                setTimeout(() => {
                    refetchSubscription();
                }, 5000);
            } else {
                toast.error('Payment URL not available. Please try again.');
            }
        } catch (error: any) {
            toast.error(`Payment failed: ${error.message}`);
        }
    };

    return (
        <div className="space-y-6">
            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="plans">Upgrade</TabsTrigger>
                    <TabsTrigger value="history">History</TabsTrigger>
                    <TabsTrigger value="billing">Billing Info</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                    <CurrentPlanCard
                        subscription={subscription ?? null}
                        quota={quota ?? null}
                        isLoading={isLoading}
                        onUpgradeClick={() => {
                            const tabsList = document.querySelector('[role="tablist"]');
                            const plansTab = tabsList?.querySelector('[value="plans"]') as HTMLElement;
                            plansTab?.click();
                        }}
                    />
                </TabsContent>

                <TabsContent value="plans" className="space-y-6">
                    <div className="text-center space-y-2 mb-8">
                        <h2 className="text-3xl font-bold">Choose Your Plan</h2>
                        <p className="text-muted-foreground">Select the plan that best fits your needs</p>
                    </div>
                    <PricingPlans
                        plans={plans || []}
                        currentPlanType={subscription?.plan_type || 'free'}
                        onSelectPlan={handleSelectPlan}
                        isLoading={isLoading}
                    />
                </TabsContent>

                <TabsContent value="history" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Payment History</CardTitle>
                            <CardDescription>View all your past transactions</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {!history || history.length === 0 ? (
                                <div className="text-center py-10 text-muted-foreground">
                                    No payment history found
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {history.map((transaction) => (
                                        <div
                                            key={transaction.id}
                                            className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                                        >
                                            <div className="space-y-1">
                                                <p className="font-medium">
                                                    {transaction.plan_purchased.charAt(0).toUpperCase() + transaction.plan_purchased.slice(1)} Plan
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {format(new Date(transaction.created_at), 'MMMM d, yyyy HH:mm')}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Order ID: {transaction.merchant_order_id}
                                                </p>
                                            </div>
                                            <div className="text-right space-y-1">
                                                <p className="font-bold">
                                                    {new Intl.NumberFormat('id-ID', {
                                                        style: 'currency',
                                                        currency: 'IDR',
                                                        maximumFractionDigits: 0
                                                    }).format(transaction.amount)}
                                                </p>
                                                <Badge
                                                    variant={
                                                        transaction.status === 'success' ? 'default' :
                                                            transaction.status === 'pending' ? 'secondary' :
                                                                'destructive'
                                                    }
                                                >
                                                    {transaction.status}
                                                </Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="billing" className="space-y-4">
                    <BillingInformationForm />
                </TabsContent>
            </Tabs>

            <PaymentMethodModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                plan={selectedPlan}
                onConfirm={handleConfirmPayment}
                isProcessing={isCreating}
            />
        </div>
    );
}

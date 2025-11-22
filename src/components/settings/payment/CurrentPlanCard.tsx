import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Subscription } from '@/types/subscription';
import { UserQuota } from '@/lib/services/SubscriptionService';
import { format } from 'date-fns';
import { Loader2, Zap } from 'lucide-react';

interface CurrentPlanCardProps {
    subscription: Subscription | null;
    quota: UserQuota | null;
    isLoading: boolean;
    onUpgradeClick: () => void;
}

export function CurrentPlanCard({ subscription, quota, isLoading, onUpgradeClick }: CurrentPlanCardProps) {
    if (isLoading) {
        return (
            <Card>
                <CardContent className="pt-6 flex justify-center items-center min-h-[200px]">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </CardContent>
            </Card>
        );
    }

    const planType = subscription?.plan_type || 'free';
    const isPro = planType === 'pro';
    const isActive = subscription?.status === 'active';

    // Quota Logic
    const limit = quota?.messages_limit || 0;
    const used = quota?.messages_used || 0;
    // If limit is very high (e.g. > 100000) or plan is pro, treat as unlimited
    const isUnlimited = isPro || limit > 100000;
    const percentage = isUnlimited ? 0 : Math.min(100, (used / limit) * 100);

    return (
        <Card className="w-full">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-2xl font-bold flex items-center gap-2">
                            {planType.charAt(0).toUpperCase() + planType.slice(1)} Plan
                            {isActive && <Badge variant="default" className="bg-green-500">Active</Badge>}
                        </CardTitle>
                        <CardDescription>
                            {subscription
                                ? `Renews on ${format(new Date(subscription.valid_until), 'MMMM d, yyyy')}`
                                : 'You are currently on the free plan'}
                        </CardDescription>
                    </div>
                    <div className="p-3 bg-primary/10 rounded-full">
                        <Zap className="h-6 w-6 text-primary" />
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Quota Usage */}
                <div className="space-y-2">
                    <div className="flex justify-between text-sm font-medium">
                        <span>Message Quota</span>
                        <span>
                            {used} / {isUnlimited ? <span className="text-lg leading-none">∞</span> : limit}
                        </span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                    <p className="text-xs text-muted-foreground text-right">
                        {isUnlimited
                            ? 'You have unlimited messages'
                            : `${limit - used} messages remaining this month`}
                    </p>
                </div>

                {/* Plan Details */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-muted-foreground">Billing Cycle</p>
                        <p className="font-medium">{subscription?.billing_cycle || 'Monthly'}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Amount</p>
                        <p className="font-medium">
                            {subscription
                                ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(subscription.price)
                                : 'Free'}
                        </p>
                    </div>
                </div>
            </CardContent>
            <CardFooter>
                {!isPro && (
                    <Button onClick={onUpgradeClick} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg">
                        Upgrade Plan
                    </Button>
                )}
                {isPro && (
                    <Button variant="outline" className="w-full">
                        Manage Subscription
                    </Button>
                )}
            </CardFooter>
        </Card>
    );
}

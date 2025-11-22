import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PricingPlan, PlanType } from '@/types/subscription';
import { Check } from 'lucide-react';

interface PricingPlansProps {
    plans: PricingPlan[];
    currentPlanType: PlanType;
    onSelectPlan: (plan: PricingPlan) => void;
    isLoading: boolean;
}

export function PricingPlans({ plans, currentPlanType, onSelectPlan, isLoading }: PricingPlansProps) {
    if (isLoading) {
        return <div className="text-center py-10">Loading plans...</div>;
    }

    return (
        <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => {
                const isCurrent = plan.plan_type === currentPlanType;
                const isPro = plan.plan_type === 'pro';

                return (
                    <Card key={plan.id} className={`relative flex flex-col ${isPro ? 'border-primary shadow-lg scale-105' : ''}`}>
                        {isPro && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                <Badge className="bg-primary text-primary-foreground px-3 py-1">Most Popular</Badge>
                            </div>
                        )}
                        <CardHeader>
                            <CardTitle className="text-xl">{plan.plan_name}</CardTitle>
                            <CardDescription>{plan.description}</CardDescription>
                            <div className="mt-4">
                                <span className="text-3xl font-bold">
                                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(plan.price)}
                                </span>
                                <span className="text-muted-foreground">/{plan.billing_cycle === 'monthly' ? 'mo' : 'yr'}</span>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1">
                            <ul className="space-y-3 text-sm">
                                {plan.features.map((feature, index) => (
                                    <li key={index} className="flex items-center gap-2">
                                        <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                        <CardFooter>
                            <Button
                                className="w-full"
                                variant={isCurrent ? "outline" : (isPro ? "default" : "secondary")}
                                disabled={isCurrent}
                                onClick={() => onSelectPlan(plan)}
                            >
                                {isCurrent ? 'Current Plan' : 'Choose Plan'}
                            </Button>
                        </CardFooter>
                    </Card>
                );
            })}
        </div>
    );
}

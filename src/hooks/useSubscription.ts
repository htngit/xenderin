import { useQuery } from '@tanstack/react-query';
import { subscriptionService } from '@/lib/services/SubscriptionService';

export function useSubscription() {
    const {
        data: subscription,
        isLoading: isLoadingSubscription,
        error: subscriptionError,
        refetch: refetchSubscription
    } = useQuery({
        queryKey: ['subscription'],
        queryFn: subscriptionService.getCurrentSubscription
    });

    const {
        data: plans,
        isLoading: isLoadingPlans,
        error: plansError
    } = useQuery({
        queryKey: ['pricing_plans'],
        queryFn: subscriptionService.getPricingPlans
    });

    const {
        data: history,
        isLoading: isLoadingHistory,
        error: historyError,
        refetch: refetchHistory
    } = useQuery({
        queryKey: ['payment_history'],
        queryFn: subscriptionService.getPaymentHistory
    });

    const {
        data: quota,
        isLoading: isLoadingQuota,
        error: quotaError,
        refetch: refetchQuota
    } = useQuery({
        queryKey: ['user_quota'],
        queryFn: subscriptionService.getUserQuota
    });

    return {
        subscription,
        plans,
        history,
        quota,
        isLoading: isLoadingSubscription || isLoadingPlans || isLoadingHistory || isLoadingQuota,
        error: subscriptionError || plansError || historyError || quotaError,
        refetchSubscription,
        refetchHistory,
        refetchQuota
    };
}

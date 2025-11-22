import { useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentService } from '@/lib/services/PaymentService';
import { toast } from 'sonner';

export function usePayment() {
    const queryClient = useQueryClient();

    const createPaymentMutation = useMutation({
        mutationFn: ({ planId, paymentMethod }: { planId: string; paymentMethod: string }) =>
            paymentService.createPayment(planId, paymentMethod),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payment_history'] });
        },
        onError: (error: any) => {
            toast.error(`Payment initiation failed: ${error.message}`);
        }
    });

    const verifyPaymentMutation = useMutation({
        mutationFn: (transactionId: string) => paymentService.verifyPayment(transactionId),
        onSuccess: (data) => {
            if (data.status === 'success') {
                toast.success('Payment verified successfully! Subscription updated.');
                queryClient.invalidateQueries({ queryKey: ['subscription'] });
                queryClient.invalidateQueries({ queryKey: ['payment_history'] });
            } else if (data.status === 'pending') {
                toast.info('Payment is still pending.');
            } else {
                toast.error(`Payment status: ${data.status}`);
            }
        },
        onError: (error: any) => {
            toast.error(`Verification failed: ${error.message}`);
        }
    });

    return {
        createPayment: createPaymentMutation.mutateAsync,
        verifyPayment: verifyPaymentMutation.mutateAsync,
        isCreating: createPaymentMutation.isPending,
        isVerifying: verifyPaymentMutation.isPending,
        createError: createPaymentMutation.error,
        verifyError: verifyPaymentMutation.error
    };
}

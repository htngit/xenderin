import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { billingService } from '@/lib/services/BillingService';
import { toast } from 'sonner';
import { userContextManager } from '@/lib/security/UserContextManager';

export function useBillingInfo() {
    return useQuery({
        queryKey: ['billingInfo'],
        queryFn: async () => {
            const userId = await userContextManager.getCurrentMasterUserId();
            if (!userId) {
                throw new Error('User ID not found');
            }
            return billingService.getBillingInfo(userId);
        },
    });
}

export function useSaveBillingInfo() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (billingData: Parameters<typeof billingService.saveBillingInfo>[1]) => {
            const userId = await userContextManager.getCurrentMasterUserId();
            if (!userId) {
                throw new Error('User ID not found');
            }
            return billingService.saveBillingInfo(userId, billingData);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['billingInfo'] });
            toast.success('Billing information saved successfully');
        },
        onError: (error: Error) => {
            toast.error(`Failed to save billing information: ${error.message}`);
        },
    });
}

export function useRefundRequests() {
    return useQuery({
        queryKey: ['refundRequests'],
        queryFn: async () => {
            const userId = await userContextManager.getCurrentMasterUserId();
            if (!userId) {
                throw new Error('User ID not found');
            }
            return billingService.getRefundRequests(userId);
        },
    });
}

export function useCreateRefundRequest() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (refundData: Parameters<typeof billingService.createRefundRequest>[1]) => {
            const userId = await userContextManager.getCurrentMasterUserId();
            if (!userId) {
                throw new Error('User ID not found');
            }
            return billingService.createRefundRequest(userId, refundData);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['refundRequests'] });
            toast.success('Refund request submitted successfully');
        },
        onError: (error: Error) => {
            toast.error(`Failed to submit refund request: ${error.message}`);
        },
    });
}

export function useGenerateInvoice() {
    return useMutation({
        mutationFn: (transactionId: string) => billingService.generateInvoice(transactionId),
        onSuccess: (data) => {
            toast.success('Invoice generated successfully');
            // Open invoice in new window/tab
            if (data.invoice_url) {
                window.open(data.invoice_url, '_blank');
            }
        },
        onError: (error: Error) => {
            toast.error(`Failed to generate invoice: ${error.message}`);
        },
    });
}

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { paymentService } from '@/lib/services/PaymentService';

import { toast } from 'sonner';

const SUPPORTED_PAYMENT_METHODS = ['OL', 'DA', 'LQRIS', 'NQRIS', 'BC'] as const;
type PaymentMethod = typeof SUPPORTED_PAYMENT_METHODS[number];

interface CreatePaymentParams {
  planId: string;
  paymentMethod: PaymentMethod;
}

export function usePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: CreatePaymentParams) =>
      paymentService.createPayment(params.planId, params.paymentMethod),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['pricing_plans'] });
      queryClient.invalidateQueries({ queryKey: ['payment_history'] });
      queryClient.invalidateQueries({ queryKey: ['user_quota'] });
      toast.success('Payment initiated successfully');
    },

    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'An unknown error occurred';
      toast.error(`Payment creation failed: ${message}`);
    },
  });
}
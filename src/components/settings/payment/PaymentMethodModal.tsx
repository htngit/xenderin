"use client"

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface PricingPlan {
  id: string;
  name: string;
  price: number;
  description?: string;
}

const SUPPORTED_PAYMENT_METHODS = [
  { value: 'OL', label: 'Kartu Kredit/Debit' },
  { value: 'DA', label: 'DANA' },
  { value: 'LQRIS', label: 'Link QRIS' },
  { value: 'NQRIS', label: 'QRIS' },
  { value: 'BC', label: 'Bank Transfer' },
  { value: 'VA_BCA_A1', label: 'VA BCA (A1)' },
] as const;

type PaymentMethod = typeof SUPPORTED_PAYMENT_METHODS[number]['value'];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  plan: PricingPlan | null;
  onConfirm: (method: PaymentMethod) => void;
  isProcessing: boolean;
}

export function PaymentMethodModal({
  isOpen,
  onClose,
  plan,
  onConfirm,
  isProcessing,
}: Props) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);

  const handleConfirm = () => {
    if (selectedMethod) {
      onConfirm(selectedMethod);
      setSelectedMethod(null);
    }
  };

  if (!plan) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Pilih Metode Pembayaran</DialogTitle>
          <DialogDescription>
            Lengkapi pembayaran untuk <strong>{plan.name}</strong>
            <br />
            <span className="text-2xl font-bold text-primary">
              Rp {plan.price.toLocaleString('id-ID')}
            </span>
            {plan.description && (
              <p className="mt-2 text-sm">{plan.description}</p>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-2 py-4 sm:grid-cols-2">
          {SUPPORTED_PAYMENT_METHODS.map((method) => (
            <Button
              key={method.value}
              variant={selectedMethod === method.value ? 'default' : 'outline'}
              className="justify-start h-12"
              onClick={() => setSelectedMethod(method.value)}
              disabled={isProcessing}
            >
              {method.label}
            </Button>
          ))}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isProcessing}
          >
            Batal
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedMethod || isProcessing}
            className="ml-auto sm:ml-0"
          >
            {isProcessing ? 'Memproses...' : 'Bayar Sekarang'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
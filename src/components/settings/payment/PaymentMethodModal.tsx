import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { PricingPlan } from '@/types/subscription';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface PaymentMethodModalProps {
    isOpen: boolean;
    onClose: () => void;
    plan: PricingPlan | null;
    onConfirm: (paymentMethod: string) => void;
    isProcessing: boolean;
}

const PAYMENT_METHODS = [
    // Virtual Accounts
    { id: 'BC', name: 'BCA Virtual Account', category: 'va' },
    { id: 'M2', name: 'Mandiri Virtual Account', category: 'va' },
    { id: 'BR', name: 'BRI Virtual Account', category: 'va' },
    // E-Wallets
    { id: 'OV', name: 'OVO', category: 'ewallet' },
    { id: 'DA', name: 'DANA', category: 'ewallet' },
    { id: 'LA', name: 'LinkAja', category: 'ewallet' },
];

export function PaymentMethodModal({ isOpen, onClose, plan, onConfirm, isProcessing }: PaymentMethodModalProps) {
    const [selectedMethod, setSelectedMethod] = useState('BC'); // Default to BCA

    if (!plan) return null;

    const vaMethods = PAYMENT_METHODS.filter(m => m.category === 'va');
    const ewalletMethods = PAYMENT_METHODS.filter(m => m.category === 'ewallet');

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Confirm Subscription</DialogTitle>
                    <DialogDescription>
                        You are upgrading to the <span className="font-bold text-foreground">{plan.plan_name}</span> plan.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                        <span className="text-sm font-medium">Total Amount</span>
                        <span className="text-xl font-bold">
                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(plan.price)}
                        </span>
                    </div>

                    <div className="space-y-4">
                        <Label>Select Payment Method</Label>
                        <div className="h-[300px] overflow-y-auto border rounded-md p-4 space-y-6">
                            <RadioGroup value={selectedMethod} onValueChange={setSelectedMethod}>
                                {/* Virtual Accounts Group */}
                                <div className="space-y-3">
                                    <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                                        <span className="w-1 h-4 bg-primary rounded-full"></span>
                                        Virtual Accounts
                                    </h4>
                                    <div className="grid gap-2">
                                        {vaMethods.map((method) => (
                                            <div key={method.id} className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors">
                                                <RadioGroupItem value={method.id} id={method.id} />
                                                <Label htmlFor={method.id} className="flex-1 cursor-pointer font-medium">{method.name}</Label>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* E-Wallets Group */}
                                <div className="space-y-3">
                                    <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                                        <span className="w-1 h-4 bg-green-500 rounded-full"></span>
                                        E-Wallets
                                    </h4>
                                    <div className="grid gap-2">
                                        {ewalletMethods.map((method) => (
                                            <div key={method.id} className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors">
                                                <RadioGroupItem value={method.id} id={method.id} />
                                                <Label htmlFor={method.id} className="flex-1 cursor-pointer font-medium">{method.name}</Label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </RadioGroup>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isProcessing}>Cancel</Button>
                    <Button onClick={() => onConfirm(selectedMethod)} disabled={isProcessing}>
                        {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Proceed to Payment
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

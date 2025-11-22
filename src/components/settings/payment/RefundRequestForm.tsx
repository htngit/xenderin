import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useRefundRequests, useCreateRefundRequest } from '@/hooks/useBilling';
import { useSubscription } from '@/hooks/useSubscription';
import { Loader2, Plus, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function RefundRequestForm() {
    const { data: refundRequests, isLoading: loadingRefunds } = useRefundRequests();
    const { history, isLoading: loadingHistory } = useSubscription();
    const createRefund = useCreateRefundRequest();
    const [isOpen, setIsOpen] = useState(false);

    const [formData, setFormData] = useState({
        transaction_id: '',
        reason: '',
        details: '',
        bank_name: '',
        account_number: '',
        account_holder: '',
    });

    // Filter eligible transactions (within 7 days, successful, no existing refund)
    const eligibleTransactions = history?.filter(tx => {
        const daysSincePurchase = (Date.now() - new Date(tx.created_at).getTime()) / (1000 * 60 * 60 * 24);
        const hasRefund = refundRequests?.some(r => r.transaction_id === tx.id);
        return tx.status === 'success' && daysSincePurchase <= 7 && !hasRefund;
    }) || [];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await createRefund.mutateAsync(formData);
        setIsOpen(false);
        setFormData({
            transaction_id: '',
            reason: '',
            details: '',
            bank_name: '',
            account_number: '',
            account_holder: '',
        });
    };

    const getStatusBadge = (status: string) => {
        const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
            submitted: 'secondary',
            under_review: 'default',
            approved: 'default',
            rejected: 'destructive',
            transferred: 'outline',
        };
        return <Badge variant={variants[status] || 'default'}>{status.replace('_', ' ').toUpperCase()}</Badge>;
    };

    if (loadingRefunds || loadingHistory) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin" />
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Refund Requests</CardTitle>
                            <CardDescription>
                                Request a refund within 7 days of purchase
                            </CardDescription>
                        </div>
                        <Dialog open={isOpen} onOpenChange={setIsOpen}>
                            <DialogTrigger asChild>
                                <Button disabled={eligibleTransactions.length === 0}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    New Request
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                    <DialogTitle>Submit Refund Request</DialogTitle>
                                    <DialogDescription>
                                        Fill in the form below to request a refund. Refunds are processed within 3-5 business days.
                                    </DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="transaction">Transaction *</Label>
                                        <Select
                                            value={formData.transaction_id}
                                            onValueChange={(value) => setFormData({ ...formData, transaction_id: value })}
                                            required
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select transaction" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {eligibleTransactions.map((tx) => (
                                                    <SelectItem key={tx.id} value={tx.id}>
                                                        {tx.plan_purchased} - Rp {tx.amount.toLocaleString('id-ID')} ({new Date(tx.created_at).toLocaleDateString('id-ID')})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="reason">Reason *</Label>
                                        <Select
                                            value={formData.reason}
                                            onValueChange={(value) => setFormData({ ...formData, reason: value })}
                                            required
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select reason" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="changed_mind">Changed my mind</SelectItem>
                                                <SelectItem value="technical_issues">Technical issues</SelectItem>
                                                <SelectItem value="duplicate_payment">Duplicate payment</SelectItem>
                                                <SelectItem value="other">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="details">Details *</Label>
                                        <Textarea
                                            id="details"
                                            value={formData.details}
                                            onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                                            placeholder="Please provide additional details about your refund request"
                                            required
                                            rows={4}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="bank_name">Bank Name *</Label>
                                            <Input
                                                id="bank_name"
                                                value={formData.bank_name}
                                                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                                                placeholder="e.g., BCA, Mandiri"
                                                required
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="account_number">Account Number *</Label>
                                            <Input
                                                id="account_number"
                                                value={formData.account_number}
                                                onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="account_holder">Account Holder Name *</Label>
                                        <Input
                                            id="account_holder"
                                            value={formData.account_holder}
                                            onChange={(e) => setFormData({ ...formData, account_holder: e.target.value })}
                                            placeholder="Name as shown on bank account"
                                            required
                                        />
                                    </div>

                                    <div className="flex gap-2 pt-4">
                                        <Button type="submit" disabled={createRefund.isPending}>
                                            {createRefund.isPending ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                    Submitting...
                                                </>
                                            ) : (
                                                'Submit Request'
                                            )}
                                        </Button>
                                        <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                                            Cancel
                                        </Button>
                                    </div>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardHeader>
                <CardContent>
                    {eligibleTransactions.length === 0 && (
                        <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                No eligible transactions for refund. Refunds can only be requested within 7 days of purchase.
                            </AlertDescription>
                        </Alert>
                    )}

                    {refundRequests && refundRequests.length > 0 ? (
                        <div className="space-y-4">
                            {refundRequests.map((request) => (
                                <div key={request.id} className="border rounded-lg p-4 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium">{request.refund_number}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {new Date(request.created_at).toLocaleDateString('id-ID')}
                                            </p>
                                        </div>
                                        {getStatusBadge(request.status)}
                                    </div>
                                    <div className="text-sm">
                                        <p><strong>Reason:</strong> {request.reason.replace('_', ' ')}</p>
                                        <p><strong>Details:</strong> {request.details}</p>
                                        <p><strong>Bank:</strong> {request.bank_name} - {request.account_number}</p>
                                        {request.admin_notes && (
                                            <p className="mt-2 text-muted-foreground"><strong>Admin Notes:</strong> {request.admin_notes}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-muted-foreground py-8">No refund requests yet</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

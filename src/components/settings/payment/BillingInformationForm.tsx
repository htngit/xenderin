import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBillingInfo, useSaveBillingInfo } from '@/hooks/useBilling';
import { Loader2, Edit, Save, X } from 'lucide-react';

export function BillingInformationForm() {
    const { data: billingInfo, isLoading } = useBillingInfo();
    const saveBillingInfo = useSaveBillingInfo();
    const [isEditing, setIsEditing] = useState(false);

    const [formData, setFormData] = useState({
        full_name: '',
        company_name: '',
        tax_id: '',
        email: '',
        phone: '',
        street_address: '',
        city: '',
        state: '',
        postal_code: '',
        country: 'Indonesia',
    });

    // Update form when billing info loads
    useEffect(() => {
        if (billingInfo) {
            setFormData({
                full_name: billingInfo.full_name || '',
                company_name: billingInfo.company_name || '',
                tax_id: billingInfo.tax_id || '',
                email: billingInfo.email || '',
                phone: billingInfo.phone || '',
                street_address: billingInfo.street_address || '',
                city: billingInfo.city || '',
                state: billingInfo.state || '',
                postal_code: billingInfo.postal_code || '',
                country: billingInfo.country || 'Indonesia',
            });
        }
    }, [billingInfo]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await saveBillingInfo.mutateAsync(formData);
        setIsEditing(false);
    };

    const handleCancel = () => {
        if (billingInfo) {
            setFormData({
                full_name: billingInfo.full_name || '',
                company_name: billingInfo.company_name || '',
                tax_id: billingInfo.tax_id || '',
                email: billingInfo.email || '',
                phone: billingInfo.phone || '',
                street_address: billingInfo.street_address || '',
                city: billingInfo.city || '',
                state: billingInfo.state || '',
                postal_code: billingInfo.postal_code || '',
                country: billingInfo.country || 'Indonesia',
            });
        }
        setIsEditing(false);
    };

    if (isLoading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Billing Information</CardTitle>
                        <CardDescription>
                            {billingInfo
                                ? 'Manage your billing details for invoices and renewals'
                                : 'Add billing information for subscription renewals'}
                        </CardDescription>
                    </div>
                    {!isEditing && billingInfo && (
                        <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="full_name">Full Name *</Label>
                            <Input
                                id="full_name"
                                value={formData.full_name}
                                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                disabled={!isEditing && !!billingInfo}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="company_name">Company Name</Label>
                            <Input
                                id="company_name"
                                value={formData.company_name}
                                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                                disabled={!isEditing && !!billingInfo}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Email *</Label>
                            <Input
                                id="email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                disabled={!isEditing && !!billingInfo}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone</Label>
                            <Input
                                id="phone"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                disabled={!isEditing && !!billingInfo}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="tax_id">Tax ID / NPWP</Label>
                            <Input
                                id="tax_id"
                                value={formData.tax_id}
                                onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                                disabled={!isEditing && !!billingInfo}
                                placeholder="Optional"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="postal_code">Postal Code *</Label>
                            <Input
                                id="postal_code"
                                value={formData.postal_code}
                                onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                                disabled={!isEditing && !!billingInfo}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="street_address">Street Address *</Label>
                        <Input
                            id="street_address"
                            value={formData.street_address}
                            onChange={(e) => setFormData({ ...formData, street_address: e.target.value })}
                            disabled={!isEditing && !!billingInfo}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="city">City *</Label>
                            <Input
                                id="city"
                                value={formData.city}
                                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                disabled={!isEditing && !!billingInfo}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="state">State/Province *</Label>
                            <Input
                                id="state"
                                value={formData.state}
                                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                                disabled={!isEditing && !!billingInfo}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="country">Country</Label>
                            <Input
                                id="country"
                                value={formData.country}
                                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                                disabled={!isEditing && !!billingInfo}
                            />
                        </div>
                    </div>

                    {(isEditing || !billingInfo) && (
                        <div className="flex gap-2 pt-4">
                            <Button type="submit" disabled={saveBillingInfo.isPending}>
                                {saveBillingInfo.isPending ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="h-4 w-4 mr-2" />
                                        Save
                                    </>
                                )}
                            </Button>
                            {billingInfo && (
                                <Button type="button" variant="outline" onClick={handleCancel}>
                                    <X className="h-4 w-4 mr-2" />
                                    Cancel
                                </Button>
                            )}
                        </div>
                    )}
                </form>
            </CardContent>
        </Card>
    );
}

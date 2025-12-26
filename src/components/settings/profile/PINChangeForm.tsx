import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { userContextManager } from '@/lib/security/UserContextManager';
import { Loader2, Lock, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useIntl, FormattedMessage } from 'react-intl';

export function PINChangeForm() {
    const intl = useIntl();
    const [currentPIN, setCurrentPIN] = useState('');
    const [newPIN, setNewPIN] = useState('');
    const [confirmPIN, setConfirmPIN] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [storedPIN, setStoredPIN] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        const fetchCurrentPIN = async () => {
            try {
                // console.log('[PINChangeForm] Fetching current user...');
                const user = await userContextManager.getCurrentUser();
                if (!user) {
                    // console.log('[PINChangeForm] No user found');
                    return;
                }

                // console.log('[PINChangeForm] User ID:', user.id);
                setUserId(user.id);

                const { data, error } = await supabase
                    .from('profiles')
                    .select('pin')
                    .eq('id', user.id)
                    .single();

                if (error) {
                    console.error('[PINChangeForm] Error fetching PIN:', error);
                    toast.error(intl.formatMessage({ id: 'settings.pin.toast.error_load', defaultMessage: 'Failed to load current PIN' }));
                    return;
                }

                // console.log('[PINChangeForm] Fetched PIN:', data?.pin ? '******' : 'null');
                setStoredPIN(data?.pin || '123456');
            } catch (err) {
                console.error('[PINChangeForm] Error in fetchCurrentPIN:', err);
                toast.error(intl.formatMessage({ id: 'settings.pin.toast.error_load_data', defaultMessage: 'Error loading PIN data' }));
            }
        };

        fetchCurrentPIN();
    }, [intl]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (currentPIN.length !== 6 || !/^\d+$/.test(currentPIN)) {
            toast.error(intl.formatMessage({ id: 'settings.pin.toast.length_current' }));
            return;
        }

        if (newPIN.length !== 6 || !/^\d+$/.test(newPIN)) {
            toast.error(intl.formatMessage({ id: 'settings.pin.toast.length_new' }));
            return;
        }

        if (newPIN !== confirmPIN) {
            toast.error(intl.formatMessage({ id: 'settings.pin.toast.mismatch' }));
            return;
        }

        if (currentPIN !== storedPIN) {
            toast.error(intl.formatMessage({ id: 'settings.pin.toast.incorrect' }));
            return;
        }

        if (newPIN === currentPIN) {
            toast.error(intl.formatMessage({ id: 'settings.pin.toast.same' }));
            return;
        }

        if (!userId) {
            toast.error(intl.formatMessage({ id: 'common.error.user_not_found', defaultMessage: 'User not found' }));
            return;
        }

        setIsLoading(true);

        try {
            // console.log('[PINChangeForm] Updating PIN for user:', userId);
            const { data, error } = await supabase
                .from('profiles')
                .update({
                    pin: newPIN,
                    pin_updated_at: new Date().toISOString()
                })
                .eq('id', userId)
                .select();

            // console.log('[PINChangeForm] Update result:', { data, error });

            if (error) throw error;

            setStoredPIN(newPIN);
            setCurrentPIN('');
            setNewPIN('');
            setConfirmPIN('');
            toast.success(intl.formatMessage({ id: 'settings.pin.toast.success' }));
        } catch (err: unknown) {
            console.error('[PINChangeForm] Error updating PIN:', err);
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            toast.error(intl.formatMessage(
                { id: 'settings.pin.toast.error' },
                { error: errorMessage }
            ));
        } finally {
            setIsLoading(false);
        }
    };

    const isValid =
        currentPIN.length === 6 &&
        newPIN.length === 6 &&
        confirmPIN.length === 6 &&
        newPIN === confirmPIN &&
        /^\d+$/.test(currentPIN) &&
        /^\d+$/.test(newPIN);

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Lock className="h-5 w-5 text-primary" />
                    <div>
                        <CardTitle>
                            <FormattedMessage id="settings.pin.title" defaultMessage="Change PIN" />
                        </CardTitle>
                        <CardDescription>
                            <FormattedMessage id="settings.pin.desc" defaultMessage="Update your 6-digit security PIN" />
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="currentPIN">
                            <FormattedMessage id="settings.pin.current" defaultMessage="Current PIN" />
                        </Label>
                        <Input
                            id="currentPIN"
                            type="password"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={6}
                            value={currentPIN}
                            onChange={(e) => setCurrentPIN(e.target.value.replace(/\D/g, ''))}
                            placeholder={intl.formatMessage({ id: 'settings.pin.current_placeholder', defaultMessage: 'Enter current 6-digit PIN' })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="newPIN">
                            <FormattedMessage id="settings.pin.new" defaultMessage="New PIN" />
                        </Label>
                        <Input
                            id="newPIN"
                            type="password"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={6}
                            value={newPIN}
                            onChange={(e) => setNewPIN(e.target.value.replace(/\D/g, ''))}
                            placeholder={intl.formatMessage({ id: 'settings.pin.new_placeholder', defaultMessage: 'Enter new 6-digit PIN' })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="confirmPIN">
                            <FormattedMessage id="settings.pin.confirm" defaultMessage="Confirm New PIN" />
                        </Label>
                        <div className="relative">
                            <Input
                                id="confirmPIN"
                                type="password"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                value={confirmPIN}
                                onChange={(e) => setConfirmPIN(e.target.value.replace(/\D/g, ''))}
                                placeholder={intl.formatMessage({ id: 'settings.pin.confirm_placeholder', defaultMessage: 'Confirm new 6-digit PIN' })}
                            />
                            {confirmPIN.length > 0 && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    {newPIN === confirmPIN ? (
                                        <Check className="h-4 w-4 text-green-500" />
                                    ) : (
                                        <X className="h-4 w-4 text-red-500" />
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <Button type="submit" disabled={!isValid || isLoading} className="w-full">
                        {isLoading ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                <FormattedMessage id="settings.pin.updating" defaultMessage="Updating PIN..." />
                            </>
                        ) : (
                            <FormattedMessage id="settings.pin.update" defaultMessage="Update PIN" />
                        )}
                    </Button>

                    <p className="text-xs text-muted-foreground text-center">
                        <FormattedMessage id="settings.pin.help" defaultMessage="PIN must be exactly 6 digits" />
                    </p>
                </form>
            </CardContent>
        </Card>
    );
}

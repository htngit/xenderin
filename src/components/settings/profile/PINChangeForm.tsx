import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { userContextManager } from '@/lib/security/UserContextManager';
import { Loader2, Lock, Check, X } from 'lucide-react';
import { toast } from 'sonner';

export function PINChangeForm() {
    const [currentPIN, setCurrentPIN] = useState('');
    const [newPIN, setNewPIN] = useState('');
    const [confirmPIN, setConfirmPIN] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [storedPIN, setStoredPIN] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        const fetchCurrentPIN = async () => {
            try {
                console.log('[PINChangeForm] Fetching current user...');
                const user = await userContextManager.getCurrentUser();
                if (!user) {
                    console.log('[PINChangeForm] No user found');
                    return;
                }

                console.log('[PINChangeForm] User ID:', user.id);
                setUserId(user.id);

                const { data, error } = await supabase
                    .from('profiles')
                    .select('pin')
                    .eq('id', user.id)
                    .single();

                if (error) {
                    console.error('[PINChangeForm] Error fetching PIN:', error);
                    toast.error('Failed to load current PIN');
                    return;
                }

                console.log('[PINChangeForm] Fetched PIN:', data?.pin ? '******' : 'null');
                setStoredPIN(data?.pin || '123456');
            } catch (err) {
                console.error('[PINChangeForm] Error in fetchCurrentPIN:', err);
                toast.error('Error loading PIN data');
            }
        };

        fetchCurrentPIN();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (currentPIN.length !== 6 || !/^\d+$/.test(currentPIN)) {
            toast.error('Current PIN must be 6 digits');
            return;
        }

        if (newPIN.length !== 6 || !/^\d+$/.test(newPIN)) {
            toast.error('New PIN must be 6 digits');
            return;
        }

        if (newPIN !== confirmPIN) {
            toast.error('New PIN and confirmation do not match');
            return;
        }

        if (currentPIN !== storedPIN) {
            toast.error('Current PIN is incorrect');
            return;
        }

        if (newPIN === currentPIN) {
            toast.error('New PIN must be different from current PIN');
            return;
        }

        if (!userId) {
            toast.error('User not found');
            return;
        }

        setIsLoading(true);

        try {
            console.log('[PINChangeForm] Updating PIN for user:', userId);
            const { data, error } = await supabase
                .from('profiles')
                .update({
                    pin: newPIN,
                    pin_updated_at: new Date().toISOString()
                })
                .eq('id', userId)
                .select();

            console.log('[PINChangeForm] Update result:', { data, error });

            if (error) throw error;

            setStoredPIN(newPIN);
            setCurrentPIN('');
            setNewPIN('');
            setConfirmPIN('');
            toast.success('PIN updated successfully');
        } catch (err: unknown) {
            console.error('[PINChangeForm] Error updating PIN:', err);
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            toast.error(`Failed to update PIN: ${errorMessage}`);
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
                        <CardTitle>Change PIN</CardTitle>
                        <CardDescription>
                            Update your 6-digit security PIN
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="currentPIN">Current PIN</Label>
                        <Input
                            id="currentPIN"
                            type="password"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={6}
                            value={currentPIN}
                            onChange={(e) => setCurrentPIN(e.target.value.replace(/\D/g, ''))}
                            placeholder="Enter current 6-digit PIN"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="newPIN">New PIN</Label>
                        <Input
                            id="newPIN"
                            type="password"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={6}
                            value={newPIN}
                            onChange={(e) => setNewPIN(e.target.value.replace(/\D/g, ''))}
                            placeholder="Enter new 6-digit PIN"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="confirmPIN">Confirm New PIN</Label>
                        <div className="relative">
                            <Input
                                id="confirmPIN"
                                type="password"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                value={confirmPIN}
                                onChange={(e) => setConfirmPIN(e.target.value.replace(/\D/g, ''))}
                                placeholder="Confirm new 6-digit PIN"
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
                                Updating PIN...
                            </>
                        ) : (
                            'Update PIN'
                        )}
                    </Button>

                    <p className="text-xs text-muted-foreground text-center">
                        PIN must be exactly 6 digits
                    </p>
                </form>
            </CardContent>
        </Card>
    );
}

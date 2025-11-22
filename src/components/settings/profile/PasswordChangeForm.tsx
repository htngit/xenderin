import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { Loader2, Key, Check, X } from 'lucide-react';
import { toast } from 'sonner';

export function PasswordChangeForm() {
    const [isChanging, setIsChanging] = useState(false);
    const [formData, setFormData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong'>('weak');

    const calculatePasswordStrength = (password: string): 'weak' | 'medium' | 'strong' => {
        let strength = 0;
        if (password.length >= 8) strength++;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
        if (/\d/.test(password)) strength++;
        if (/[^a-zA-Z\d]/.test(password)) strength++;

        if (strength <= 1) return 'weak';
        if (strength <= 3) return 'medium';
        return 'strong';
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newPassword = e.target.value;
        setFormData({ ...formData, newPassword });
        setPasswordStrength(calculatePasswordStrength(newPassword));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (formData.newPassword !== formData.confirmPassword) {
            toast.error('New passwords do not match');
            return;
        }

        if (formData.newPassword.length < 8) {
            toast.error('Password must be at least 8 characters long');
            return;
        }

        if (passwordStrength === 'weak') {
            toast.error('Password is too weak. Please use a stronger password.');
            return;
        }

        setIsChanging(true);

        try {
            // Update password using Supabase Auth
            const { error } = await supabase.auth.updateUser({
                password: formData.newPassword
            });

            if (error) {
                throw error;
            }

            toast.success('Password changed successfully');
            setFormData({
                currentPassword: '',
                newPassword: '',
                confirmPassword: '',
            });
        } catch (error: any) {
            toast.error(`Failed to change password: ${error.message}`);
        } finally {
            setIsChanging(false);
        }
    };

    const getStrengthColor = () => {
        switch (passwordStrength) {
            case 'weak': return 'bg-red-500';
            case 'medium': return 'bg-yellow-500';
            case 'strong': return 'bg-green-500';
        }
    };

    const getStrengthWidth = () => {
        switch (passwordStrength) {
            case 'weak': return 'w-1/3';
            case 'medium': return 'w-2/3';
            case 'strong': return 'w-full';
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>
                    Update your password to keep your account secure
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="currentPassword">Current Password</Label>
                        <Input
                            id="currentPassword"
                            type="password"
                            value={formData.currentPassword}
                            onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="newPassword">New Password</Label>
                        <Input
                            id="newPassword"
                            type="password"
                            value={formData.newPassword}
                            onChange={handlePasswordChange}
                            required
                        />
                        {formData.newPassword && (
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                        <div className={`h-full ${getStrengthColor()} ${getStrengthWidth()} transition-all`} />
                                    </div>
                                    <span className="text-xs font-medium capitalize">{passwordStrength}</span>
                                </div>
                                <div className="text-xs text-muted-foreground space-y-1">
                                    <div className="flex items-center gap-1">
                                        {formData.newPassword.length >= 8 ? (
                                            <Check className="h-3 w-3 text-green-500" />
                                        ) : (
                                            <X className="h-3 w-3 text-red-500" />
                                        )}
                                        <span>At least 8 characters</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {/[a-z]/.test(formData.newPassword) && /[A-Z]/.test(formData.newPassword) ? (
                                            <Check className="h-3 w-3 text-green-500" />
                                        ) : (
                                            <X className="h-3 w-3 text-red-500" />
                                        )}
                                        <span>Uppercase and lowercase letters</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {/\d/.test(formData.newPassword) ? (
                                            <Check className="h-3 w-3 text-green-500" />
                                        ) : (
                                            <X className="h-3 w-3 text-red-500" />
                                        )}
                                        <span>At least one number</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirm New Password</Label>
                        <Input
                            id="confirmPassword"
                            type="password"
                            value={formData.confirmPassword}
                            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                            required
                        />
                        {formData.confirmPassword && (
                            <div className="flex items-center gap-1 text-xs">
                                {formData.newPassword === formData.confirmPassword ? (
                                    <>
                                        <Check className="h-3 w-3 text-green-500" />
                                        <span className="text-green-500">Passwords match</span>
                                    </>
                                ) : (
                                    <>
                                        <X className="h-3 w-3 text-red-500" />
                                        <span className="text-red-500">Passwords do not match</span>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    <Button type="submit" disabled={isChanging} className="w-full">
                        {isChanging ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Changing Password...
                            </>
                        ) : (
                            <>
                                <Key className="h-4 w-4 mr-2" />
                                Change Password
                            </>
                        )}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}

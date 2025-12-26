import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordChangeForm } from './PasswordChangeForm';
import { PINChangeForm } from './PINChangeForm';
import { supabase } from '@/lib/supabase';
import { Loader2, Edit, Save, X, User } from 'lucide-react';
import { toast } from 'sonner';
import { userContextManager } from '@/lib/security/UserContextManager';
import { useIntl, FormattedMessage } from 'react-intl';

export function ProfileTab() {
    const intl = useIntl();
    const [user, setUser] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [formData, setFormData] = useState({
        displayName: '',
        phone: '',
    });

    useEffect(() => {
        fetchUserProfile();
    }, []);

    const fetchUserProfile = async () => {
        try {
            const user = await userContextManager.getCurrentUser();
            if (user) {
                setUser(user);
                setFormData({
                    displayName: user.user_metadata?.display_name || '',
                    phone: user.user_metadata?.phone || '',
                });
            }
        } catch (error) {
            console.error('Error fetching user profile:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const { error } = await supabase.auth.updateUser({
                data: {
                    display_name: formData.displayName,
                    phone: formData.phone,
                }
            });

            if (error) throw error;

            toast.success(intl.formatMessage({ id: 'settings.profile.toast.update_success' }));
            setIsEditing(false);
            await fetchUserProfile();
        } catch (error: any) {
            toast.error(intl.formatMessage(
                { id: 'settings.profile.toast.update_error' },
                { error: error.message }
            ));
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setFormData({
            displayName: user?.user_metadata?.display_name || '',
            phone: user?.user_metadata?.phone || '',
        });
        setIsEditing(false);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Profile Information */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>
                                <FormattedMessage id="settings.profile.info.title" defaultMessage="Profile Information" />
                            </CardTitle>
                            <CardDescription>
                                <FormattedMessage id="settings.profile.info.desc" defaultMessage="Manage your personal information" />
                            </CardDescription>
                        </div>
                        {!isEditing && (
                            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                                <Edit className="h-4 w-4 mr-2" />
                                <FormattedMessage id="contacts.action.edit" defaultMessage="Edit" />
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-8 w-8 text-primary" />
                        </div>
                        <div>
                            <p className="font-medium">
                                {formData.displayName || <FormattedMessage id="settings.profile.no_name" defaultMessage="No name set" />}
                            </p>
                            <p className="text-sm text-muted-foreground">{user?.email}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="displayName">
                                <FormattedMessage id="settings.profile.display_name" defaultMessage="Display Name" />
                            </Label>
                            <Input
                                id="displayName"
                                value={formData.displayName}
                                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                                disabled={!isEditing}
                                placeholder={intl.formatMessage({ id: 'settings.profile.name_placeholder', defaultMessage: 'Enter your name' })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">
                                <FormattedMessage id="settings.profile.email" defaultMessage="Email" />
                            </Label>
                            <Input
                                id="email"
                                value={user?.email || ''}
                                disabled
                                className="bg-muted"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="phone">
                                <FormattedMessage id="settings.profile.phone" defaultMessage="Phone Number" />
                            </Label>
                            <Input
                                id="phone"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                disabled={!isEditing}
                                placeholder={intl.formatMessage({ id: 'settings.profile.phone_placeholder', defaultMessage: '+62 xxx xxxx xxxx' })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>
                                <FormattedMessage id="settings.profile.created_at" defaultMessage="Account Created" />
                            </Label>
                            <Input
                                value={user?.created_at ? new Date(user.created_at).toLocaleDateString(intl.locale === 'id' ? 'id-ID' : 'en-US') : intl.formatMessage({ id: 'common.na', defaultMessage: 'N/A' })}
                                disabled
                                className="bg-muted"
                            />
                        </div>
                    </div>

                    {isEditing && (
                        <div className="flex gap-2 pt-4">
                            <Button onClick={handleSave} disabled={isSaving}>
                                {isSaving ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        <FormattedMessage id="settings.profile.saving" defaultMessage="Saving..." />
                                    </>
                                ) : (
                                    <>
                                        <Save className="h-4 w-4 mr-2" />
                                        <FormattedMessage id="common.button.save" defaultMessage="Save Changes" />
                                    </>
                                )}
                            </Button>
                            <Button variant="outline" onClick={handleCancel}>
                                <X className="h-4 w-4 mr-2" />
                                <FormattedMessage id="common.button.cancel" defaultMessage="Cancel" />
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Password Change */}
            <PasswordChangeForm />

            {/* PIN Change */}
            <PINChangeForm />

            {/* Account Security Info */}
            <Card>
                <CardHeader>
                    <CardTitle>
                        <FormattedMessage id="settings.profile.security.title" defaultMessage="Account Security" />
                    </CardTitle>
                    <CardDescription>
                        <FormattedMessage id="settings.profile.security.desc" defaultMessage="Additional security information" />
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm font-medium">
                            <FormattedMessage id="settings.profile.last_signin" defaultMessage="Last Sign In" />
                        </span>
                        <span className="text-sm text-muted-foreground">
                            {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString(intl.locale === 'id' ? 'id-ID' : 'en-US') : intl.formatMessage({ id: 'common.na', defaultMessage: 'N/A' })}
                        </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm font-medium">
                            <FormattedMessage id="settings.profile.email_verified" defaultMessage="Email Verified" />
                        </span>
                        <span className="text-sm text-muted-foreground">
                            {user?.email_confirmed_at
                                ? <FormattedMessage id="common.yes" defaultMessage="Yes" />
                                : <FormattedMessage id="common.no" defaultMessage="No" />
                            }
                        </span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                        <span className="text-sm font-medium">
                            <FormattedMessage id="settings.profile.user_id" defaultMessage="User ID" />
                        </span>
                        <span className="text-sm text-muted-foreground font-mono text-xs">
                            {user?.id?.substring(0, 8)}...
                        </span>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

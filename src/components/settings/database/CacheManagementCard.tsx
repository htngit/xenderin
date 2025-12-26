import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { FormattedMessage, useIntl } from 'react-intl';

export function CacheManagementCard() {
    const intl = useIntl();
    const [isClearing, setIsClearing] = useState(false);
    const [lastCleared, setLastCleared] = useState<Date | null>(null);

    const handleClearCache = async () => {
        setIsClearing(true);
        try {
            // Clear browser cache (limited to what we can control)
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => caches.delete(name)));
            }

            // Clear localStorage items (except auth)
            const keysToKeep = ['supabase.auth.token', 'master_user_id'];
            Object.keys(localStorage).forEach(key => {
                // Keep Supabase auth tokens (usually start with sb- or contain auth-token)
                if (key.startsWith('sb-') || key.includes('auth-token') || keysToKeep.some(keepKey => key.includes(keepKey))) {
                    return;
                }
                localStorage.removeItem(key);
            });

            const now = new Date();
            setLastCleared(now);
            toast.success(intl.formatMessage({ id: 'settings.database.cache.toast.success' }));
        } catch (error) {
            toast.error(intl.formatMessage(
                { id: 'settings.database.cache.toast.error' },
                { error: (error as Error).message }
            ));
        } finally {
            setIsClearing(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    <FormattedMessage id="settings.database.cache.title" defaultMessage="Cache Management" />
                </CardTitle>
                <CardDescription>
                    <FormattedMessage id="settings.database.cache.desc" defaultMessage="Clear temporary data and cached files" />
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-start gap-3 p-3 rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/20">
                    <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
                            <FormattedMessage id="settings.database.cache.warning.title" defaultMessage="Warning" />
                        </p>
                        <p className="text-sm text-orange-700 dark:text-orange-300">
                            <FormattedMessage id="settings.database.cache.warning.desc" defaultMessage="Clearing cache will remove temporary files and may require re-downloading some data." />
                        </p>
                    </div>
                </div>

                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full" disabled={isClearing}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            <FormattedMessage id="settings.database.cache.btn_clear" defaultMessage="Clear Cache" />
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>
                                <FormattedMessage id="settings.database.cache.dialog.title" defaultMessage="Are you sure?" />
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                <FormattedMessage id="settings.database.cache.dialog.desc" defaultMessage="This will clear all cached data." />
                            </AlertDialogDescription>
                        </AlertDialogHeader>

                        <div className="text-sm text-muted-foreground">
                            <p className="mb-2">
                                <FormattedMessage id="settings.database.cache.dialog.includes" defaultMessage="This includes:" />
                            </p>
                            <ul className="list-disc list-inside space-y-1 mb-4">
                                <li><FormattedMessage id="settings.database.cache.dialog.item1" defaultMessage="Temporary files" /></li>
                                <li><FormattedMessage id="settings.database.cache.dialog.item2" defaultMessage="Cached images and media" /></li>
                                <li><FormattedMessage id="settings.database.cache.dialog.item3" defaultMessage="Application cache" /></li>
                            </ul>
                            <p>
                                <FormattedMessage id="settings.database.cache.dialog.safe" defaultMessage="Your messages, contacts, and settings will remain safe." />
                            </p>
                        </div>

                        <AlertDialogFooter>
                            <AlertDialogCancel>
                                <FormattedMessage id="settings.database.cache.dialog.cancel" defaultMessage="Cancel" />
                            </AlertDialogCancel>
                            <AlertDialogAction onClick={handleClearCache}>
                                <FormattedMessage id="settings.database.cache.dialog.confirm" defaultMessage="Clear Cache" />
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <p className="text-xs text-muted-foreground text-center">
                    {lastCleared ? (
                        <FormattedMessage
                            id="settings.database.cache.last_cleared"
                            defaultMessage="Last cleared: {time}"
                            values={{ time: lastCleared.toLocaleTimeString() }}
                        />
                    ) : (
                        <FormattedMessage
                            id="settings.database.cache.last_cleared"
                            defaultMessage="Last cleared: {time}"
                            values={{ time: intl.formatMessage({ id: 'settings.database.sync.never_time', defaultMessage: 'Never' }) }}
                        />
                    )}
                </p>
            </CardContent>
        </Card>
    );
}

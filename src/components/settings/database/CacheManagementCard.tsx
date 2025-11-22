import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export function CacheManagementCard() {
    const [isClearing, setIsClearing] = useState(false);

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

            toast.success('Cache cleared successfully');
        } catch (error) {
            toast.error('Failed to clear cache: ' + (error as Error).message);
        } finally {
            setIsClearing(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Cache Management</CardTitle>
                <CardDescription>
                    Clear temporary data and cached files
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-start gap-3 p-3 rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/20">
                    <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
                            Warning
                        </p>
                        <p className="text-sm text-orange-700 dark:text-orange-300">
                            Clearing cache will remove temporary files and may require re-downloading some data. Your messages and contacts will not be affected.
                        </p>
                    </div>
                </div>

                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full" disabled={isClearing}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Clear Cache
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will clear all cached data.
                            </AlertDialogDescription>
                        </AlertDialogHeader>

                        <div className="text-sm text-muted-foreground">
                            <p className="mb-2">This includes:</p>
                            <ul className="list-disc list-inside space-y-1 mb-4">
                                <li>Temporary files</li>
                                <li>Cached images and media</li>
                                <li>Application cache</li>
                            </ul>
                            <p>
                                Your messages, contacts, and settings will remain safe.
                            </p>
                        </div>

                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleClearCache}>
                                Clear Cache
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <p className="text-xs text-muted-foreground text-center">
                    Last cleared: Never
                </p>
            </CardContent>
        </Card>
    );
}

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface SyncStatusCardProps {
    lastSyncTime?: Date;
    syncStatus: 'synced' | 'syncing' | 'error' | 'never';
    onManualSync: () => Promise<void>;
}

export function SyncStatusCard({ lastSyncTime, syncStatus, onManualSync }: SyncStatusCardProps) {
    const [isSyncing, setIsSyncing] = useState(false);

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            await onManualSync();
            toast.success('Sync completed successfully');
        } catch (error) {
            toast.error('Sync failed: ' + (error as Error).message);
        } finally {
            setIsSyncing(false);
        }
    };

    const getStatusBadge = () => {
        switch (syncStatus) {
            case 'synced':
                return (
                    <Badge variant="outline" className="gap-1">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        Synced
                    </Badge>
                );
            case 'syncing':
                return (
                    <Badge variant="outline" className="gap-1">
                        <RefreshCw className="h-3 w-3 animate-spin text-blue-500" />
                        Syncing...
                    </Badge>
                );
            case 'error':
                return (
                    <Badge variant="destructive" className="gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Error
                    </Badge>
                );
            default:
                return (
                    <Badge variant="secondary" className="gap-1">
                        <Clock className="h-3 w-3" />
                        Never Synced
                    </Badge>
                );
        }
    };

    const formatLastSync = () => {
        if (!lastSyncTime) return 'Never';
        const now = new Date();
        const diff = now.getTime() - lastSyncTime.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        return 'Just now';
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Sync Status</CardTitle>
                        <CardDescription>
                            Synchronization between local database and Supabase
                        </CardDescription>
                    </div>
                    {getStatusBadge()}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium">Last Sync</p>
                        <p className="text-sm text-muted-foreground">{formatLastSync()}</p>
                    </div>
                    <Button
                        onClick={handleSync}
                        disabled={isSyncing || syncStatus === 'syncing'}
                        size="sm"
                    >
                        {isSyncing ? (
                            <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Syncing...
                            </>
                        ) : (
                            <>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Sync Now
                            </>
                        )}
                    </Button>
                </div>

                <div className="text-xs text-muted-foreground">
                    <p>• Auto-sync runs every 5 minutes when online</p>
                    <p>• Manual sync updates all data from Supabase</p>
                </div>
            </CardContent>
        </Card>
    );
}

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useIntl, FormattedMessage } from 'react-intl';

interface SyncStatusCardProps {
    lastSyncTime?: Date;
    syncStatus: 'synced' | 'syncing' | 'error' | 'never';
    onManualSync: () => Promise<void>;
}

export function SyncStatusCard({ lastSyncTime, syncStatus, onManualSync }: SyncStatusCardProps) {
    const intl = useIntl();
    const [isSyncing, setIsSyncing] = useState(false);

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            await onManualSync();
            toast.success(intl.formatMessage({ id: 'settings.database.sync.toast.success' }));
        } catch (error) {
            toast.error(intl.formatMessage(
                { id: 'settings.database.sync.toast.error' },
                { error: (error as Error).message }
            ));
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
                        <FormattedMessage id="settings.database.sync.synced" defaultMessage="Synced" />
                    </Badge>
                );
            case 'syncing':
                return (
                    <Badge variant="outline" className="gap-1">
                        <RefreshCw className="h-3 w-3 animate-spin text-blue-500" />
                        <FormattedMessage id="settings.database.sync.syncing" defaultMessage="Syncing..." />
                    </Badge>
                );
            case 'error':
                return (
                    <Badge variant="destructive" className="gap-1">
                        <AlertCircle className="h-3 w-3" />
                        <FormattedMessage id="settings.database.sync.error" defaultMessage="Error" />
                    </Badge>
                );
            default:
                return (
                    <Badge variant="secondary" className="gap-1">
                        <Clock className="h-3 w-3" />
                        <FormattedMessage id="settings.database.sync.never" defaultMessage="Never Synced" />
                    </Badge>
                );
        }
    };

    const formatLastSync = () => {
        if (!lastSyncTime) return intl.formatMessage({ id: 'settings.database.sync.never_time', defaultMessage: 'Never' });
        const now = new Date();
        const diff = now.getTime() - lastSyncTime.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return intl.formatMessage({ id: 'settings.database.sync.ago_days' }, { count: days });
        if (hours > 0) return intl.formatMessage({ id: 'settings.database.sync.ago_hours' }, { count: hours });
        if (minutes > 0) return intl.formatMessage({ id: 'settings.database.sync.ago_minutes' }, { count: minutes });
        return intl.formatMessage({ id: 'settings.database.sync.just_now', defaultMessage: 'Just now' });
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>
                            <FormattedMessage id="settings.database.sync.title" defaultMessage="Sync Status" />
                        </CardTitle>
                        <CardDescription>
                            <FormattedMessage id="settings.database.sync.desc" defaultMessage="Synchronization between local database and Cloud" />
                        </CardDescription>
                    </div>
                    {getStatusBadge()}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium">
                            <FormattedMessage id="settings.database.sync.last_sync" defaultMessage="Last Sync" />
                        </p>
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
                                <FormattedMessage id="settings.database.sync.syncing" defaultMessage="Syncing..." />
                            </>
                        ) : (
                            <>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                <FormattedMessage id="settings.database.sync.btn_sync" defaultMessage="Sync Now" />
                            </>
                        )}
                    </Button>
                </div>

                <div className="text-xs text-muted-foreground">
                    <p><FormattedMessage id="settings.database.sync.info_auto" defaultMessage="• Auto-sync runs every 5 minutes when online" /></p>
                    <p><FormattedMessage id="settings.database.sync.info_manual" defaultMessage="• Manual sync updates all data from Cloud" /></p>
                </div>
            </CardContent>
        </Card>
    );
}

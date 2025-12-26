import { useState, useEffect } from 'react';
import { SyncStatusCard } from './SyncStatusCard';
import { DatabaseStatsCard } from './DatabaseStatsCard';
import { CacheManagementCard } from './CacheManagementCard';
import { syncManager } from '@/lib/sync/SyncManager';
import { FormattedMessage } from 'react-intl';

export function DatabaseTab() {
    const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | 'never'>('never');
    const [lastSyncTime, setLastSyncTime] = useState<Date | undefined>();

    useEffect(() => {
        // Get initial sync status
        const checkSyncStatus = () => {
            try {
                const lastSync = localStorage.getItem('last_sync_time');
                if (lastSync) {
                    setLastSyncTime(new Date(lastSync));
                    setSyncStatus('synced');
                }
            } catch (error) {
                console.error('Failed to get sync status:', error);
            }
        };

        checkSyncStatus();

        // Poll for sync status updates
        const interval = setInterval(checkSyncStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleManualSync = async () => {
        setSyncStatus('syncing');
        try {
            // Trigger manual sync via SyncManager
            await syncManager.triggerSync();

            const now = new Date();
            setLastSyncTime(now);
            localStorage.setItem('last_sync_time', now.toISOString());
            setSyncStatus('synced');
        } catch (error) {
            console.error('Manual sync failed:', error);
            setSyncStatus('error');
            throw error;
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">
                    <FormattedMessage id="settings.database.title" defaultMessage="Database & Sync" />
                </h2>
                <p className="text-muted-foreground">
                    <FormattedMessage id="settings.database.desc" defaultMessage="Manage your local database and synchronization settings" />
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-6">
                    <SyncStatusCard
                        lastSyncTime={lastSyncTime}
                        syncStatus={syncStatus}
                        onManualSync={handleManualSync}
                    />
                    <CacheManagementCard />
                </div>
                <DatabaseStatsCard />
            </div>
        </div>
    );
}

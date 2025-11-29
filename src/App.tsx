'use client';

import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from '@/components/pages/LoginPage';
// RegisterPage, ForgotPasswordPage, ResetPasswordPage are handled within LoginPage
// import { RegisterPage } from '@/components/pages/RegisterPage';
// import { ForgotPasswordPage } from '@/components/pages/ForgotPasswordPage';
// import { ResetPasswordPage } from '@/components/pages/ResetPasswordPage';
import { PINModal } from '@/components/pages/PINModal';
import { Dashboard } from '@/components/pages/Dashboard';
import { ContactsPage } from '@/components/pages/ContactsPage';
import { TemplatesPage } from '@/components/pages/TemplatesPage';
import { AssetPage } from '@/components/pages/AssetPage';
import { SendPage } from '@/components/pages/SendPage';
import { HistoryPage } from '@/components/pages/HistoryPage';
import { CampaignHistoryPage } from '@/components/pages/CampaignHistoryPage';
import { GroupPage } from '@/components/pages/GroupPage';
import { SettingsPage } from '@/components/pages/SettingsPage';
import { ServiceProvider } from '@/lib/services/ServiceContext';
import { AuthResponse, PINValidation, serviceManager } from '@/lib/services';
import { AuthService } from '@/lib/services/AuthService';
import { syncManager } from '@/lib/sync/SyncManager';

import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';
import { UserProvider } from '@/lib/security/UserProvider';
import { userContextManager } from '@/lib/security/UserContextManager';
import { db } from '@/lib/db';
import { IntlProvider } from '@/lib/i18n/IntlProvider';

// Public routes component
const PublicRoutes = ({
  onLoginSuccess
}: {
  onLoginSuccess: (data: AuthResponse) => void;
}) => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage onLoginSuccess={onLoginSuccess} initialView="login" />} />
      <Route path="/register" element={<LoginPage onLoginSuccess={onLoginSuccess} initialView="register" />} />
      <Route path="/forgot-password" element={<LoginPage onLoginSuccess={onLoginSuccess} initialView="forgot-password" />} />
      {/* Reset Password flow to be implemented or handled via deep link to a specific view */}
      <Route path="/reset-password" element={<LoginPage onLoginSuccess={onLoginSuccess} initialView="login" />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

// Protected routes component
const ProtectedRoutes = ({
  authData,
  onLogout
}: {
  authData: AuthResponse | null;
  onLogout: () => void;
}) => {
  return (
    <Routes>
      {/* Dashboard wrapped with ServiceProvider for consistent service access */}
      <Route
        path="/dashboard"
        element={
          <ServiceProvider>
            <Dashboard
              userName={authData?.user.name || 'User'}
              onLogout={onLogout}
            />
          </ServiceProvider>
        }
      />

      {/* Other pages consume services via ServiceProvider */}
      <Route
        path="/contacts"
        element={
          <ServiceProvider>
            <ContactsPage />
          </ServiceProvider>
        }
      />
      <Route
        path="/templates"
        element={
          <ServiceProvider>
            <TemplatesPage />
          </ServiceProvider>
        }
      />
      <Route
        path="/assets"
        element={
          <ServiceProvider>
            <AssetPage />
          </ServiceProvider>
        }
      />
      <Route
        path="/send"
        element={
          <ServiceProvider>
            <SendPage userName={authData?.user.name || 'User'} />
          </ServiceProvider>
        }
      />
      <Route
        path="/history"
        element={
          <ServiceProvider>
            <HistoryPage />
          </ServiceProvider>
        }
      />
      <Route
        path="/campaign-history"
        element={
          <ServiceProvider>
            <CampaignHistoryPage />
          </ServiceProvider>
        }
      />
      <Route
        path="/groups"
        element={
          <ServiceProvider>
            <GroupPage />
          </ServiceProvider>
        }
      />
      <Route
        path="/settings"
        element={
          <ServiceProvider>
            <SettingsPage userName={authData?.user.name || 'User'} />
          </ServiceProvider>
        }
      />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

// Main App Logic
const MainApp = () => {
  const { toast } = useToast();
  const [authData, setAuthData] = useState<AuthResponse | null>(null);
  const [pinData, setPinData] = useState<PINValidation | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  // Restore session on load
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const authService = new AuthService();
        const user = await authService.getCurrentUser();

        if (user) {
          // We have a user, but we don't have quota yet (fetched after PIN)
          // However, we need to set authData to consider them "authenticated"
          setAuthData({
            user,
            token: '', // Token handled by provider
            // quota is optional now
          });

          // Note: We do NOT auto-validate PIN here. 
          // User must enter PIN every time they reload/re-open app (Architecture Requirement)
        }
      } catch (error) {
        console.error('Failed to restore session:', error);
      } finally {
        setIsRestoringSession(false);
      }
    };

    restoreSession();
  }, []);

  const handleLoginSuccess = (data: AuthResponse) => {
    // Check if the current user is different from the last logged in user
    const previousUserId = userContextManager.getLastUserId();
    if (previousUserId && previousUserId !== data.user.id) {
      // Different user is logging in, clear the old user's data
      db.clearUserData(previousUserId).catch(error => {
        console.error('Error clearing old user data:', error);
      });
    }

    setAuthData(data);
    // Do NOT set PIN data yet. User must enter PIN.

    // Set the current user as the last user
    userContextManager.setLastUserId(data.user.id);
  };

  const handlePINValidated = async (data: PINValidation, accountId: string) => {
    // 1. Fetch account metadata (Quota, etc.) now that we have access
    try {
      const authService = new AuthService();
      const { quota } = await authService.getAccountMetadata(accountId);

      // 2. Update authData with the fetched quota
      setAuthData(prev => prev ? { ...prev, quota } : null);

      // 3. Set PIN data to unlock the UI
      setPinData(data);

      // 4. Start Sync Manager (Deferred until PIN is validated)
      let masterUserId = authData?.user?.master_user_id;
      if (!masterUserId) {
        // Fallback if authData isn't fully ready, though it should be
        const user = await authService.getCurrentUser();
        if (user) {
          masterUserId = user.master_user_id;
        }
      }

      if (masterUserId) {
        syncManager.setMasterUserId(masterUserId);

        // 5. Check connection speed and decide sync strategy
        const { checkConnectionSpeed, getSyncPercentageBySpeed, getSyncStrategyBySpeed } = await import('@/lib/utils/connectionSpeed');
        const connectionSpeed = await checkConnectionSpeed();

        // Define sync strategy based on connection speed
        const syncStrategy = getSyncStrategyBySpeed(connectionSpeed);
        const syncPercentage = getSyncPercentageBySpeed(connectionSpeed);

        console.log(`Connection speed: ${connectionSpeed} Mbps, Strategy: ${syncStrategy}, Percentage: ${syncPercentage * 100}%`);

        // Determine which tables to sync based on strategy
        const { getTablesByPriority } = await import('@/lib/sync/SyncPriority');
        const tablesByPriority = getTablesByPriority();
        let criticalTables = tablesByPriority.critical;
        let highPriorityTables = tablesByPriority.high;
        let mediumPriorityTables = tablesByPriority.medium;
        let lowPriorityTables = tablesByPriority.low;

        // Show sync indicator to user
        // In a real implementation, you might want to show a progress indicator
        console.log(`Starting ${syncStrategy} sync...`);

        switch (syncStrategy) {
          case 'full':
            // Full sync: sync all tables
            await syncManager.sync();
            break;

          case 'partial':
            // 50% sync: sync critical and high priority tables first
            const partialTables = [...criticalTables, ...highPriorityTables];
            await syncManager.partialSync(partialTables, syncPercentage);

            // Background sync: sync remaining tables in background
            const backgroundTables = [...mediumPriorityTables, ...lowPriorityTables];
            await syncManager.backgroundSync(backgroundTables);
            break;

          case 'background':
            // Start with critical tables only, rest in background
            const criticalSyncTables = [...criticalTables];
            await syncManager.partialSync(criticalSyncTables, 1.0); // Full sync for critical

            // Background sync for all other tables
            const remainingTables = [...highPriorityTables, ...mediumPriorityTables, ...lowPriorityTables];
            await syncManager.backgroundSync(remainingTables);
            break;

          default:
            // Fallback to partial sync
            const fallbackTables = [...criticalTables, ...highPriorityTables];
            await syncManager.partialSync(fallbackTables, 0.5);
            break;
        }

        console.log('Sync completed based on connection speed');

        // Initialize all services after sync is complete
        await serviceManager.initializeAllServices(masterUserId);

        // After all services are initialized, we need to wait for any background syncs to complete
        // before running asset sync to avoid conflicts
        setTimeout(async () => {
          try {
            console.log('Waiting for background sync to complete before asset sync...');
            // Use a timeout to ensure background syncs finish
            await new Promise(resolve => setTimeout(resolve, 2000));

            console.log('Starting asset sync from Supabase...');
            toast({
              title: "Syncing Assets",
              description: "Downloading your assets from the cloud...",
              duration: 3000
            });

            const assetService = serviceManager.getAssetService();
            const syncResult = await assetService.syncAssetsFromSupabase();
            console.log('Asset sync completed:', syncResult);

            if (syncResult.syncedCount > 0) {
              toast({
                title: "Assets Sync Complete",
                description: `Successfully downloaded ${syncResult.syncedCount} assets from the cloud.`,
                duration: 3000
              });
            } else if (syncResult.skippedCount === 0 && syncResult.errorCount === 0) {
              toast({
                title: "Assets Already Up-to-Date",
                description: "No new assets to download.",
                duration: 3000
              });
            }
          } catch (assetSyncError) {
            console.error('Error during asset sync from Supabase:', assetSyncError);
            toast({
              title: "Asset Sync Failed",
              description: "Could not download your assets. Please check your connection.",
              variant: "destructive",
              duration: 3000
            });
            // Continue anyway - assets are not critical for core functionality
          }
        }, 0); // Use setTimeout to move this to the next event loop cycle
      }
    } catch (error) {
      console.error("Failed to load account data after PIN:", error);
      // Handle error (maybe show toast)
      // Still proceed to unlock UI, sync will happen later if needed
      setPinData(data);
    }
  };

  const handleLogout = async () => {
    const authService = new AuthService();
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setAuthData(null);
      setPinData(null);
      syncManager.setMasterUserId(null);
    }
  };

  if (isRestoringSession) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  const isAuthenticated = !!authData?.user;
  const isPINValidated = !!pinData?.is_valid;

  return (
    <Router>
      <div className="min-h-screen bg-background font-sans antialiased">
        {!isAuthenticated ? (
          // 1. Not Authenticated -> Public Routes
          <PublicRoutes onLoginSuccess={handleLoginSuccess} />
        ) : !isPINValidated ? (
          // 2. Authenticated but Locked -> PIN Modal
          // We render this as a full-screen overlay or the only content
          <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
            <PINModal
              onPINValidated={handlePINValidated}
              userName={authData?.user.name || 'User'}
              userId={authData?.user.id}
            />
          </div>
        ) : (
          // 3. Authenticated & Unlocked -> Protected Routes
          <ProtectedRoutes
            authData={authData}
            onLogout={handleLogout}
          />
        )}
        <Toaster />
      </div>
    </Router>
  );
};

export default function App() {
  return (
    <UserProvider>
      <IntlProvider>
        <MainApp />
      </IntlProvider>
    </UserProvider>
  );
}
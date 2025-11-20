import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Stagger } from '@/components/ui/animations';
import { QuotaService, AuthService, PaymentService } from '@/lib/services';
import { Quota } from '@/lib/services/types';
import { useUser } from '@/lib/security/UserProvider';
import { serviceManager } from '@/lib/services/ServiceInitializationManager';
import { FirstTimeUserService } from '@/lib/services/FirstTimeUserService';
import { InitialSyncOrchestrator, SyncProgress } from '@/lib/services/InitialSyncOrchestrator';
import { InitialSyncScreen } from '../ui/InitialSyncScreen';
import { Skeleton } from '../ui/skeleton';
import {
  BarChart3,
  Users,
  MessageSquare,
  Clock,
  TrendingUp,
  Send,
  Settings,
  LogOut,
  Menu,
  X,
  File,
  Wifi,
  WifiOff
} from 'lucide-react';

interface DashboardProps {
  userName: string;
  onLogout: () => void;
}

interface Activity {
  id: string;
  type: 'send' | 'template' | 'contact';
  description: string;
  time: string;
  status: 'success' | 'partial' | 'pending' | 'failed';
}

export function Dashboard({ userName, onLogout }: DashboardProps) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { masterUserId, isLoading: isUserLoading } = useUser();

  // App state
  const [appState, setAppState] = useState<'loading' | 'first-time-sync' | 'ready' | 'error'>('loading');
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Real‑time data
  const [quota, setQuota] = useState<Quota | null>(null);
  const [stats, setStats] = useState({
    totalContacts: 0,
    totalTemplates: 0,
    messagesSent: 0,
    quotaRemaining: 0,
    quotaLimit: 0
  });
  const [isConnected, setIsConnected] = useState(false);

  // Recent activity fetched from local service
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);

  // Subscriptions refs
  const quotaSubscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const paymentSubscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);

  // Guard against double init
  const initializedRef = useRef(false);

  // Services instances - Memoized using useRef to prevent re-instantiation
  const authService = useRef(new AuthService()).current;
  const quotaService = useRef(new QuotaService()).current;
  const paymentService = useRef(new PaymentService()).current;

  // ---------------------------------------------------------------------
  // Initialization logic (runs once when user info is ready)
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!isUserLoading && masterUserId && !initializedRef.current) {
      initializedRef.current = true;
      initializeApp();
    }
  }, [isUserLoading, masterUserId]);

  const initializeApp = async () => {
    try {
      // Check if we've already initialized in this session
      if (serviceManager.isDashboardInitialized()) {
        setAppState('ready');
      } else {
        setAppState('loading');
      }

      const currentMasterUserId = masterUserId;
      if (!currentMasterUserId) throw new Error('No master user ID available. Please log in again.');

      // Initialise all services
      await serviceManager.initializeAllServices(currentMasterUserId);

      // Check first‑time user
      const firstTimeService = new FirstTimeUserService();
      const isFirstTime = await firstTimeService.checkIfFirstTimeUser(currentMasterUserId);

      if (isFirstTime) {
        setAppState('first-time-sync');
        await performInitialSync(currentMasterUserId);
      } else {
        setAppState('ready');
        await initializeUserData();
        setupPaymentSubscription();

        // Mark as initialized for this session
        serviceManager.markDashboardInitialized();
      }
    } catch (err: any) {
      console.error('App initialization failed:', err);
      setError(err.message || 'Unexpected error during initialization');
      setAppState('error');
      initializedRef.current = false;
    }
  };

  // Perform initial sync for first‑time users
  const performInitialSync = async (masterUserId: string) => {
    const orchestrator = new InitialSyncOrchestrator(serviceManager);
    try {
      await orchestrator.performInitialSync(masterUserId, (progress) => setSyncProgress(progress));
      // After sync, load normal data
      await initializeUserData();
      setupPaymentSubscription();
      setAppState('ready');
    } catch (err: any) {
      console.error('Initial sync failed:', err);
      setError(err.message || 'Initial sync failed');
      setAppState('error');
    }
  };

  // ---------------------------------------------------------------------
  // Dashboard data helpers
  // ---------------------------------------------------------------------
  const initializeUserData = async () => {
    try {
      const user = await authService.getCurrentUser();
      if (!user) {
        console.warn('No authenticated user found');
        return;
      }

      // Parallel fetch for efficiency - Offline First approach
      const [currentQuota, recentLogs, contactStats, templateStats] = await Promise.all([
        quotaService.getQuota(user.id),
        serviceManager.getHistoryService().getRecentActivity(5),
        serviceManager.getContactService().getAllContacts(),
        serviceManager.getTemplateService().getTemplates()
      ]);

      if (currentQuota) {
        setQuota(currentQuota);
        setupQuotaSubscription(currentQuota.user_id);
      }

      // Update stats
      setStats({
        totalContacts: contactStats.length,
        totalTemplates: templateStats.length,
        messagesSent: currentQuota?.messages_used || 0,
        quotaRemaining: currentQuota?.remaining || 0,
        quotaLimit: currentQuota?.messages_limit || 0
      });

      // Map logs to activity
      const activities: Activity[] = recentLogs.map(log => ({
        id: log.id,
        type: 'send', // Simplified for now
        description: log.template_name || 'Message Campaign',
        time: new Date(log.created_at).toLocaleDateString(),
        status: log.status === 'completed' ? 'success' : log.status === 'failed' ? 'failed' : 'pending'
      }));
      setRecentActivity(activities);

    } catch (e) {
      console.error('Error initializing user data:', e);
    }
  };

  const setupQuotaSubscription = (userId: string) => {
    if (quotaSubscriptionRef.current) {
      quotaSubscriptionRef.current.unsubscribe();
    }
    const sub = quotaService.subscribeToQuotaUpdates(userId, (updatedQuota) => {
      setQuota(updatedQuota);
      updateStats(updatedQuota);
    });
    quotaSubscriptionRef.current = sub;
  };

  const setupPaymentSubscription = async () => {
    if (paymentSubscriptionRef.current) {
      paymentSubscriptionRef.current.unsubscribe();
    }
    try {
      const sub = await paymentService.subscribeToPaymentUpdates('all', (payment) => {
        if (payment.status === 'completed' && quota?.user_id) {
          // Refresh quota after successful payment
          quotaService.getQuota(quota.user_id).then((newQuota) => {
            if (newQuota) {
              setQuota(newQuota);
              updateStats(newQuota);
            }
          });
        }
      });
      paymentSubscriptionRef.current = sub;
    } catch (error) {
      console.error('Failed to subscribe to payment updates:', error);
    }
  };

  const cleanupSubscriptions = () => {
    if (quotaSubscriptionRef.current) {
      quotaSubscriptionRef.current.unsubscribe();
    }
    if (paymentSubscriptionRef.current) {
      paymentSubscriptionRef.current.unsubscribe();
    }
  };

  const updateStats = (currentQuota: Quota) => {
    setStats((prev) => ({
      ...prev,
      quotaRemaining: currentQuota.remaining,
      quotaLimit: currentQuota.messages_limit
    }));
  };

  const handleMenuClick = (path: string) => {
    navigate(`/${path}`);
    setSidebarOpen(false);
  };

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      cleanupSubscriptions();
    };
  }, []);

  // ---------------------------------------------------------------------
  // UI helpers
  // ---------------------------------------------------------------------
  const quotaPercentage = quota && quota.messages_limit > 0 ? (quota.remaining / quota.messages_limit) * 100 : 0;

  // ---------------------------------------------------------------------
  // Render based on appState
  // ---------------------------------------------------------------------
  // if (appState === 'loading') {
  //   return <LoadingScreen message="Initializing your workspace..." />;
  // }

  if (appState === 'first-time-sync') {
    return <InitialSyncScreen progress={syncProgress} />;
  }

  if (appState === 'error') {
    return (
      <div className="min-h-screen bg-red-50 flex flex-col items-center justify-center text-center p-4">
        <h2 className="text-xl font-bold text-red-700 mb-2">Initialization Failed</h2>
        <p className="text-red-600 mb-4">{error}</p>
        <Button onClick={initializeApp}>Try Again</Button>
      </div>
    );
  }

  // Main dashboard UI (ready)
  const menuItems = [
    { id: 'contacts', label: 'Contacts', icon: Users, description: 'Manage your contacts' },
    { id: 'groups', label: 'Groups', icon: Users, description: 'Manage contact groups' },
    { id: 'templates', label: 'Templates', icon: MessageSquare, description: 'Create and manage templates' },
    { id: 'assets', label: 'Asset Files', icon: File, description: 'Upload and manage asset files' },
    { id: 'send', label: 'Send Messages', icon: Send, description: 'Configure and send messages' },
    { id: 'history', label: 'History', icon: Clock, description: 'View activity history' },
    { id: 'settings', label: 'Settings', icon: Settings, description: 'App settings' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Mobile Header */}
      <header className="bg-white border-b p-4 flex items-center justify-between lg:hidden sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Send className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg">Xender-In</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </header>

      <div className="flex flex-1 relative">
        {/* Sidebar */}
        <aside className={`
            fixed lg:static inset-y-0 left-0 z-10 w-64 bg-white border-r transform transition-transform duration-200 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}>
          <div className="h-full flex flex-col">
            <div className="p-6 hidden lg:flex items-center gap-2 border-b">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Send className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl">Xender-In</span>
            </div>

            <div className="flex-1 overflow-y-auto py-4">
              <nav className="px-4 space-y-2">
                <Button variant="secondary" className="w-full justify-start gap-3 bg-primary/10 text-primary hover:bg-primary/20">
                  <BarChart3 className="h-4 w-4" />
                  Dashboard
                </Button>
                <div className="pt-4 pb-2">
                  <p className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Management</p>
                </div>
                {menuItems.map((item) => (
                  <Button key={item.id} variant="ghost" className="w-full justify-start gap-3" onClick={() => handleMenuClick(item.id)}>
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                ))}
              </nav>
            </div>

            <div className="p-4 border-t bg-gray-50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="font-semibold text-primary">{userName.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{userName}</p>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                    <p className="text-xs text-muted-foreground">{isConnected ? 'Connected' : 'Disconnected'}</p>
                  </div>
                </div>
                <Button variant="outline" className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={onLogout}>
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </aside>

        {/* Overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/50 z-0 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50/50">
          <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Dashboard Overview</h1>
                <p className="text-muted-foreground">Welcome back! Here's what's happening with your campaigns.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsConnected(!isConnected)}>
                  {isConnected ? <Wifi className="h-4 w-4 mr-2" /> : <WifiOff className="h-4 w-4 mr-2" />}
                  {isConnected ? 'Connected' : 'Offline'}
                </Button>
                <Button onClick={() => navigate('/send')}>
                  <Send className="h-4 w-4 mr-2" />
                  New Campaign
                </Button>
              </div>
            </div>

            {/* Stats Grid */}
            <Stagger>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    {appState === 'loading' ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      <div className="text-2xl font-bold">{stats.totalContacts}</div>
                    )}
                    <p className="text-xs text-muted-foreground">Active contacts</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Templates</CardTitle>
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    {appState === 'loading' ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      <div className="text-2xl font-bold">{stats.totalTemplates}</div>
                    )}
                    <p className="text-xs text-muted-foreground">Active templates</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Messages Sent</CardTitle>
                    <Send className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    {appState === 'loading' ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      <div className="text-2xl font-bold">{stats.messagesSent}</div>
                    )}
                    <p className="text-xs text-muted-foreground">This month</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Quota Usage</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    {appState === 'loading' ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      <div className="text-2xl font-bold">
                        {stats.quotaRemaining} / {stats.quotaLimit}
                      </div>
                    )}
                    <Progress value={quotaPercentage} className="h-2 mt-2" />
                  </CardContent>
                </Card>
              </div>
            </Stagger>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
              {/* Recent Activity */}
              <Card className="col-span-4">
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Your latest campaign and message activities</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-8">
                    {appState === 'loading' ? (
                      // Skeleton Activity
                      Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex items-center">
                          <Skeleton className="h-9 w-9 rounded-full" />
                          <div className="ml-4 space-y-1">
                            <Skeleton className="h-4 w-48" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                          <div className="ml-auto">
                            <Skeleton className="h-6 w-16 rounded-full" />
                          </div>
                        </div>
                      ))
                    ) : (
                      recentActivity.map((activity) => (
                        <div key={activity.id} className="flex items-center">
                          <div className={`
                                w-9 h-9 rounded-full flex items-center justify-center border
                                ${activity.type === 'send' ? 'bg-blue-50 border-blue-200 text-blue-600' :
                              activity.type === 'template' ? 'bg-purple-50 border-purple-200 text-purple-600' :
                                'bg-green-50 border-green-200 text-green-600'}
                              `}>
                            {activity.type === 'send' ? <Send className="h-4 w-4" /> :
                              activity.type === 'template' ? <MessageSquare className="h-4 w-4" /> :
                                <Users className="h-4 w-4" />}
                          </div>
                          <div className="ml-4 space-y-1">
                            <p className="text-sm font-medium leading-none">{activity.description}</p>
                            <p className="text-sm text-muted-foreground">{activity.time}</p>
                          </div>
                          <div className="ml-auto font-medium">
                            {activity.status === 'success' ? (
                              <Badge variant="default" className="bg-green-500 hover:bg-green-600">Success</Badge>
                            ) : (
                              <Badge variant="secondary">Pending</Badge>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card className="col-span-3">
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                  <CardDescription>Common tasks and shortcuts</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {menuItems.slice(0, 4).map((item) => (
                    <Button key={item.id} variant="outline" className="h-auto py-4 justify-start gap-4" onClick={() => handleMenuClick(item.id)}>
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <item.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold">{item.label}</div>
                        <div className="text-xs text-muted-foreground">{item.description}</div>
                      </div>
                    </Button>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
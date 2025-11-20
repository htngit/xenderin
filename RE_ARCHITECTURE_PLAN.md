# RE-ARCHITECTURE PLAN: Proper Service Initialization & First-Time User Flow

## 1. PROBLEM STATEMENT

### 1.1 Current Issues
- **TemplateService tidak diinisialisasi**:
  ```typescript
  // Di TemplatesPage.tsx line 41
  const templateService = new TemplateService();

  // Masalah: Tidak pernah dipanggil initialize(masterUserId)
  ```

- **Tidak ada First-Time User Initial Data Sync**:
  - Dashboard hanya load quota data
  - Tidak ada check untuk first-time user
  - Tidak ada initial data sync
  - User bisa langsung navigate ke TemplatesPage tapi tidak ada data

- **Service Dependencies Broken**:
  - Setiap service bergantung pada `userContextManager.getCurrentMasterUserId()`
  - UserContextManager tidak guarantee ter-set sebelum service dipanggil

- **Dashboard Tidak Mengatur Data Flow**:
  - Dashboard hanya fokus pada quota display dan navigation
  - Tidak menangani initial data loading, service initialization, sync orchestration

### 1.2 Root Cause "Templates Page Do Nothing"
1. TemplatesPage load → check user context
2. `userContextManager.getCurrentUser()` return `null` (timing issue)
3. `loadTemplates()` tidak dipanggil → no loading state
4. Even jika dipanggil, TemplateService tidak initialized → tidak ada data sync

## 2. SOLUTION OVERVIEW

### 2.1 Core Principles
- **Local-first execution** - runtime dan data local
- **Supabase = meta disk + payment processor** - bukan untuk data operasional
- **Dual Sync System**: Auto Sync (login) + Manual Sync (post-PIN)
- **50% sync rule** untuk quota dan metadata

### 2.2 Architecture Changes
1. **Dashboard sebagai Sync Orchestrator**
2. **Proper Service Initialization Patterns**
3. **First-Time User Detection & Initial Sync Flow**
4. **Enhanced Error Handling & Loading States**

## 3. IMPLEMENTATION PLAN

### PHASE 1: Foundation Setup (1-2 days)

#### 1.1 Create Service Initialization Manager
**File**: `src/lib/services/ServiceInitializationManager.ts`

**Responsibilities**:
- Centralized service initialization
- Master user ID management
- Service lifecycle management

**Implementation**:
```typescript
export class ServiceInitializationManager {
  private initializedServices = new Set<string>();
  private masterUserId: string | null = null;

  async initializeAllServices(masterUserId: string): Promise<void> {
    this.masterUserId = masterUserId;

    // Initialize in dependency order
    await this.initializeTemplateService(masterUserId);
    await this.initializeContactService(masterUserId);
    await this.initializeAssetService(masterUserId);
    await this.initializeHistoryService(masterUserId);
  }

  private async initializeTemplateService(masterUserId: string): Promise<void> {
    if (this.initializedServices.has('template')) return;

    const templateService = new TemplateService();
    await templateService.initialize(masterUserId);
    this.initializedServices.add('template');
  }
  // ... similar for other services
}
```

#### 1.2 Create First-Time User Detection Service
**File**: `src/lib/services/FirstTimeUserService.ts`

**Responsibilities**:
- Check if user has local data
- Determine sync requirements
- Manage first-time user flow

**Implementation**:
```typescript
export class FirstTimeUserService {
  async checkIfFirstTimeUser(masterUserId: string): Promise<boolean> {
    // Check local data existence
    const hasTemplates = await this.checkLocalTemplates(masterUserId);
    const hasContacts = await this.checkLocalContacts(masterUserId);
    const hasAssets = await this.checkLocalAssets(masterUserId);

    return !hasTemplates && !hasContacts && !hasAssets;
  }

  private async checkLocalTemplates(masterUserId: string): Promise<boolean> {
    const count = await db.templates.where('master_user_id').equals(masterUserId).count();
    return count > 0;
  }
  // ... similar for contacts and assets
}
```

#### 1.3 Create Initial Sync Orchestrator
**File**: `src/lib/services/InitialSyncOrchestrator.ts`

**Responsibilities**:
- Coordinate initial data sync from Supabase
- Show progress to user
- Handle sync errors gracefully

**Implementation**:
```typescript
export class InitialSyncOrchestrator {
  async performInitialSync(masterUserId: string, onProgress?: (progress: SyncProgress) => void): Promise<void> {
    const syncSteps = [
      { name: 'templates', service: templateService },
      { name: 'contacts', service: contactService },
      { name: 'assets', service: assetService },
      { name: 'history', service: historyService }
    ];

    for (const [index, step] of syncSteps.entries()) {
      try {
        onProgress?.({
          step: step.name,
          progress: (index / syncSteps.length) * 100,
          status: 'syncing'
        });

        await step.service.forceSync();

        onProgress?.({
          step: step.name,
          progress: ((index + 1) / syncSteps.length) * 100,
          status: 'completed'
        });
      } catch (error) {
        onProgress?.({
          step: step.name,
          progress: ((index + 1) / syncSteps.length) * 100,
          status: 'error',
          error: error.message
        });
        throw error;
      }
    }
  }
}
```

### PHASE 2: Dashboard Re-architecture (2-3 days)

#### 2.1 Update Dashboard as Central Orchestrator
**File**: `src/components/pages/Dashboard.tsx`

**Changes**:
- Add first-time user detection
- Add initial sync flow
- Add service initialization
- Add loading states and error handling

**Key Implementation**:
```typescript
export function Dashboard({ userName, onLogout }: DashboardProps) {
  const [appState, setAppState] = useState<'loading' | 'first-time-sync' | 'ready'>('loading');
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Get master user ID
      const masterUserId = await userContextManager.getCurrentMasterUserId();
      if (!masterUserId) throw new Error('No master user ID available');

      // Initialize all services
      const serviceManager = new ServiceInitializationManager();
      await serviceManager.initializeAllServices(masterUserId);

      // Check if first-time user
      const firstTimeService = new FirstTimeUserService();
      const isFirstTime = await firstTimeService.checkIfFirstTimeUser(masterUserId);

      if (isFirstTime) {
        setAppState('first-time-sync');
        await performInitialSync(masterUserId);
      } else {
        setAppState('ready');
      }
    } catch (error) {
      console.error('App initialization failed:', error);
      // Handle error appropriately
    }
  };

  const performInitialSync = async (masterUserId: string) => {
    const syncOrchestrator = new InitialSyncOrchestrator();

    await syncOrchestrator.performInitialSync(masterUserId, (progress) => {
      setSyncProgress(progress);
    });

    setAppState('ready');
  };

  // Render based on app state
  if (appState === 'loading') {
    return <LoadingScreen />;
  }

  if (appState === 'first-time-sync') {
    return <InitialSyncScreen progress={syncProgress} />;
  }

  return <DashboardContent />;
}
```

#### 2.2 Create Loading and Sync Screens
**Files**:
- `src/components/ui/LoadingScreen.tsx`
- `src/components/ui/InitialSyncScreen.tsx`

**LoadingScreen**:
```typescript
export function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-gray-600">Initializing your workspace...</p>
      </div>
    </div>
  );
}
```

**InitialSyncScreen**:
```typescript
interface InitialSyncScreenProps {
  progress: SyncProgress | null;
}

export function InitialSyncScreen({ progress }: InitialSyncScreenProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <AnimatedCard className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Welcome to Xender-In!</CardTitle>
          <CardDescription>
            Setting up your workspace for the first time...
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Syncing {progress?.step || 'data'}</span>
              <span>{Math.round(progress?.progress || 0)}%</span>
            </div>
            <Progress value={progress?.progress || 0} />
          </div>

          {progress?.status === 'error' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {progress.error || 'Sync failed. Please try again.'}
              </AlertDescription>
            </Alert>
          )}

          <p className="text-xs text-muted-foreground text-center">
            This may take a few moments...
          </p>
        </CardContent>
      </AnimatedCard>
    </div>
  );
}
```

### PHASE 3: Service Pages Update (3-4 days)

#### 3.1 Create Global Service Context
**File**: `src/lib/services/ServiceContext.tsx`

**Purpose**: Provide initialized services to all components

**Implementation**:
```typescript
interface ServiceContextType {
  templateService: TemplateService;
  contactService: ContactService;
  assetService: AssetService;
  historyService: HistoryService;
  isInitialized: boolean;
}

const ServiceContext = createContext<ServiceContextType | null>(null);

export function ServiceProvider({ children }: { children: React.ReactNode }) {
  const [services, setServices] = useState<ServiceContextType | null>(null);

  useEffect(() => {
    // This initialization logic might be better placed in the Dashboard
    // to ensure it runs only once after the masterUserId is confirmed.
    // For now, this demonstrates the provider's role.
    initializeServices();
  }, []);

  const initializeServices = async () => {
    try {
      const masterUserId = await userContextManager.getCurrentMasterUserId();
      if (!masterUserId) return;

      // In a real app, you'd get these instances from a singleton manager
      // that was initialized in the Dashboard.
      const templateService = new TemplateService();
      await templateService.initialize(masterUserId);

      const contactService = new ContactService();
      await contactService.initialize(masterUserId);
      
      // ... other services

      setServices({
        templateService,
        contactService,
        // assetService,
        // historyService,
        isInitialized: true
      });
    } catch (error) {
      console.error('Service initialization failed in Provider:', error);
    }
  };

  if (!services?.isInitialized) {
    return <LoadingScreen message="Initializing services..." />;
  }

  return (
    <ServiceContext.Provider value={services}>
      {children}
    </ServiceContext.Provider>
  );
}

export function useServices() {
  const context = useContext(ServiceContext);
  if (!context) {
    throw new Error('useServices must be used within a ServiceProvider');
  }
  return context;
}
```

#### 3.2 Update TemplatesPage with Proper Initialization
**File**: `src/components/pages/TemplatesPage.tsx`

**Changes**:
- Remove manual service creation
- Use `useServices` hook to get initialized service
- Add proper error handling and loading states

**Implementation**:
```typescript
export function TemplatesPage() {
  const { templateService, isInitialized } = useServices();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isInitialized) {
      loadTemplates();
    }
  }, [isInitialized]);

  const loadTemplates = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Service is now guaranteed to be initialized
      const data = await templateService.getTemplates();

      setTemplates(data);
    } catch (err) {
      console.error('Failed to load templates:', err);
      const appError = handleServiceError(err, 'loadTemplates');
      setError(appError.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <LoadingScreen message="Loading templates..." />;
  }

  if (error) {
    return <ErrorScreen error={error} onRetry={loadTemplates} />;
  }

  // Rest of component...
}
```

#### 3.3 Update All Service Pages
**Files to Update**:
- `ContactsPage.tsx`
- `AssetPage.tsx`
- `HistoryPage.tsx`
- `SendPage.tsx`

**Pattern**: Use `useServices()` hook instead of manual service creation

#### 3.4 Create Error and Loading Components
**Files**:
- `src/components/ui/ErrorScreen.tsx`
- `src/components/ui/LoadingScreen.tsx`

### PHASE 4: Error Handling & Testing (2-3 days)

#### 4.1 Enhanced Error Handling
**File**: `src/lib/utils/errorHandling.ts`

**Implementation**:
```typescript
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function handleServiceError(error: unknown, context: string): AppError {
  if (error instanceof AppError) return error;

  if (error instanceof Error) {
    // Network errors
    if (error.message.includes('fetch')) {
      return new AppError(
        'Network connection failed. Please check your internet connection.',
        'NETWORK_ERROR',
        { originalError: error.message, context }
      );
    }

    // Authentication errors
    if (error.message.includes('not authenticated')) {
      return new AppError(
        'Session expired. Please login again.',
        'AUTH_ERROR',
        { originalError: error.message, context }
      );
    }

    // Generic service errors
    return new AppError(
      `Service error: ${error.message}`,
      'SERVICE_ERROR',
      { originalError: error.message, context }
    );
  }

  return new AppError(
    'An unexpected error occurred',
    'UNKNOWN_ERROR',
    { originalError: String(error), context }
  );
}
```

#### 4.2 Add Retry Mechanisms
**File**: `src/hooks/useRetry.ts`

**Implementation**:
```typescript
export function useRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delay?: number;
    backoff?: number;
  } = {}
) {
  const { maxAttempts = 3, delay = 1000, backoff = 2 } = options;

  const [isRetrying, setIsRetrying] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);

  const execute = useCallback(async (): Promise<T> => {
    setIsRetrying(true);
    setAttemptCount(0);

    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        setAttemptCount(attempt);
        const result = await operation();
        setIsRetrying(false);
        return result;
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delay * Math.pow(backoff, attempt - 1)));
        }
      }
    }

    setIsRetrying(false);
    throw lastError!;
  }, [operation, maxAttempts, delay, backoff]);

  return { execute, isRetrying, attemptCount };
}
```

#### 4.3 Add Comprehensive Testing
**Files**:
- `src/lib/services/__tests__/ServiceInitializationManager.test.ts`
- `src/lib/services/__tests__/FirstTimeUserService.test.ts`
- `src/lib/services/__tests__/InitialSyncOrchestrator.test.ts`

### PHASE 5: Integration & Polish (2-3 days)

#### 5.1 Update App.tsx with Service Provider
**File**: `src/App.tsx`

**Changes**:
- Wrap app with ServiceProvider
- Ensure proper initialization order

#### 5.2 Add Service Health Checks
**File**: `src/lib/services/ServiceHealthChecker.ts`

**Purpose**: Monitor service health and provide diagnostics

#### 5.3 Performance Optimization
- Add service caching
- Implement lazy loading for non-critical services
- Add service warm-up for better UX

#### 5.4 Documentation Updates
- Update `Architecture_WhatsappAutomation.md`
- Add service initialization documentation
- Create troubleshooting guide

## 4. TESTING STRATEGY

### 4.1 Unit Tests
- Service initialization logic
- First-time user detection
- Error handling scenarios
- Retry mechanisms

### 4.2 Integration Tests
- End-to-end service initialization flow
- First-time user sync process
- Error recovery scenarios

### 4.3 E2E Tests
- Complete user onboarding flow
- Service page loading
- Error states and recovery

## 5. ROLLBACK PLAN

### 5.1 Feature Flags
- Add feature flags for new initialization system
- Allow gradual rollout and easy rollback

### 5.2 Backward Compatibility
- Ensure old service creation still works
- Gradual migration path

### 5.3 Monitoring
- Add service initialization metrics
- Monitor error rates and performance

## 6. SUCCESS METRICS

### 6.1 Functional Metrics
- ✅ Templates page loads data immediately
- ✅ First-time users see proper sync flow
- ✅ All services initialize correctly
- ✅ Error states handled gracefully

### 6.2 Performance Metrics
- ⏱️ App initialization < 3 seconds
- ⏱️ Service pages load < 1 second
- 📊 Error rate < 5%

### 6.3 User Experience Metrics
- 🎯 No more "do nothing" pages
- 🎯 Clear loading and error states
- 🎯 Smooth first-time user experience

## 7. TIMELINE & MILESTONES

### Week 1: Foundation (Days 1-2)
- ✅ ServiceInitializationManager
- ✅ FirstTimeUserService
- ✅ InitialSyncOrchestrator

### Week 2: Dashboard Re-architecture (Days 3-5)
- ✅ Dashboard orchestrator logic
- ✅ Loading and sync screens
- ✅ Service context setup

### Week 3: Service Pages Update (Days 6-9)
- ✅ **Create Global Service Context**
- ✅ TemplatesPage update
- ✅ ContactsPage update
- ✅ AssetPage update
- ✅ HistoryPage update

### Week 4: Error Handling & Testing (Days 10-12)
- ✅ Enhanced error handling
- ✅ Retry mechanisms
- ✅ Comprehensive testing

### Week 5: Integration & Polish (Days 13-15)
- ✅ App.tsx integration
- ✅ Performance optimization
- ✅ Documentation updates

**Total Timeline**: 3-4 weeks
**Risk Level**: Medium (requires careful service initialization order)
**Dependencies**: UserContextManager must be stable
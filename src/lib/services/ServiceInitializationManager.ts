import { AssetService } from './AssetService';
import { ContactService } from './ContactService';
import { GroupService } from './GroupService';
import { HistoryService } from './HistoryService';
import { TemplateService } from './TemplateService';
import { QuotaService } from './QuotaService';
import { AuthService } from './AuthService';
import { PaymentService } from './PaymentService';
import { SyncManager } from '../sync/SyncManager';

/**
 * A singleton manager responsible for initializing, storing, and providing
 * access to all major application services. This ensures that services are
 * initialized only once and can be accessed globally via a single source of truth.
 */
export class ServiceInitializationManager {
  private static instance: ServiceInitializationManager;

  private initializedServices = new Set<string>();
  private masterUserId: string | null = null;

  // Service instance storage
  private templateService: TemplateService | null = null;
  private contactService: ContactService | null = null;
  private groupService: GroupService | null = null;
  private assetService: AssetService | null = null;
  private historyService: HistoryService | null = null;
  private quotaService: QuotaService | null = null;
  private authService: AuthService | null = null;
  private paymentService: PaymentService | null = null;
  private syncManager: SyncManager | null = null;

  // Async lock to prevent concurrent initialization
  private isInitializing: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {
    // Private constructor to enforce singleton pattern
  }

  public static getInstance(): ServiceInitializationManager {
    if (!ServiceInitializationManager.instance) {
      ServiceInitializationManager.instance = new ServiceInitializationManager();
    }
    return ServiceInitializationManager.instance;
  }

  /**
   * Check if services have been fully initialized
   */
  public isInitialized(): boolean {
    return this.initializedServices.size === 8 &&
           this.templateService !== null &&
           this.contactService !== null &&
           this.groupService !== null &&
           this.assetService !== null &&
           this.historyService !== null &&
           this.quotaService !== null &&
           this.authService !== null &&
           this.paymentService !== null &&
           !this.isInitializing;
  }

  private _isDashboardInitialized: boolean = false;

  public isDashboardInitialized(): boolean {
    return this._isDashboardInitialized;
  }

  public markDashboardInitialized(): void {
    this._isDashboardInitialized = true;
  }

  /**
   * Initialize all services with async lock to prevent race conditions
   */
  async initializeAllServices(masterUserId: string): Promise<void> {
    if (!masterUserId) {
      throw new Error('Master user ID is required to initialize services.');
    }

    // If already fully initialized with the same user, return immediately
    if (this.isInitialized() && this.masterUserId === masterUserId) {
      console.log('Services already initialized for this user');
      return;
    }

    // If initialization is in progress, wait for it to complete
    if (this.isInitializing && this.initializationPromise) {
      console.log('Initialization in progress, waiting for completion...');
      return this.initializationPromise;
    }

    // Start initialization with async lock
    this.isInitializing = true;
    this.masterUserId = masterUserId;

    this.initializationPromise = (async () => {
      try {
        // Initialize SyncManager first
        this.syncManager = new SyncManager();

        // Initialize in dependency order
        console.log('Initializing AuthService...');
        await this.initializeService('auth', () => this.initializeAuthService(masterUserId));

        console.log('Initializing TemplateService...');
        await this.initializeService('template', () => this.initializeTemplateService(masterUserId));

        console.log('Initializing ContactService...');
        await this.initializeService('contact', () => this.initializeContactService(masterUserId));

        console.log('Initializing GroupService...');
        await this.initializeService('group', () => this.initializeGroupService(masterUserId));

        console.log('Initializing AssetService...');
        await this.initializeService('asset', () => this.initializeAssetService(masterUserId));

        console.log('Initializing HistoryService...');
        await this.initializeService('history', () => this.initializeHistoryService(masterUserId));

        console.log('Initializing QuotaService...');
        await this.initializeService('quota', () => this.initializeQuotaService(masterUserId));

        console.log('Initializing PaymentService...');
        await this.initializeService('payment', () => this.initializePaymentService(masterUserId));

        console.log('All services initialized successfully');
      } catch (error) {
        console.error('Service initialization failed:', error);
        throw error;
      } finally {
        this.isInitializing = false;
      }
    })();

    return this.initializationPromise;
  }

  // --- Service Getters ---

  public getTemplateService(): TemplateService {
    if (!this.templateService) {
      throw new Error('TemplateService not initialized. Call initializeAllServices first.');
    }
    return this.templateService;
  }

  public getContactService(): ContactService {
    if (!this.contactService) {
      throw new Error('ContactService not initialized. Call initializeAllServices first.');
    }
    return this.contactService;
  }

  public getGroupService(): GroupService {
    if (!this.groupService) {
      throw new Error('GroupService not initialized. Call initializeAllServices first.');
    }
    return this.groupService;
  }

  public getAssetService(): AssetService {
    if (!this.assetService) {
      throw new Error('AssetService not initialized. Call initializeAllServices first.');
    }
    return this.assetService;
  }

  public getHistoryService(): HistoryService {
    if (!this.historyService) {
      throw new Error('HistoryService not initialized. Call initializeAllServices first.');
    }
    return this.historyService;
  }

  public getQuotaService(): QuotaService {
    if (!this.quotaService) {
      throw new Error('QuotaService not initialized. Call initializeAllServices first.');
    }
    return this.quotaService;
  }

  public getAuthService(): AuthService {
    if (!this.authService) {
      throw new Error('AuthService not initialized. Call initializeAllServices first.');
    }
    return this.authService;
  }

  public getPaymentService(): PaymentService {
    if (!this.paymentService) {
      throw new Error('PaymentService not initialized. Call initializeAllServices first.');
    }
    return this.paymentService;
  }

  // --- Private Initializers ---

  private async initializeService(name: string, initFn: () => Promise<void>): Promise<void> {
    if (this.initializedServices.has(name)) {
      return;
    }
    try {
      await initFn();
      this.initializedServices.add(name);
    } catch (error) {
      console.error(`Failed to initialize service '${name}':`, error);
      throw new Error(`Initialization failed for service: ${name}`);
    }
  }

  private async initializeTemplateService(masterUserId: string): Promise<void> {
    if (!this.syncManager) {
      throw new Error('SyncManager not initialized');
    }
    this.templateService = new TemplateService(this.syncManager);
    await this.templateService.initialize(masterUserId);
  }

  private async initializeContactService(masterUserId: string): Promise<void> {
    if (!this.syncManager) {
      throw new Error('SyncManager not initialized');
    }
    this.contactService = new ContactService(this.syncManager);
    await this.contactService.initialize(masterUserId);
  }

  private async initializeGroupService(masterUserId: string): Promise<void> {
    if (!this.syncManager) {
      throw new Error('SyncManager not initialized');
    }
    this.groupService = new GroupService(this.syncManager);
    await this.groupService.initialize(masterUserId);
  }

  private async initializeAssetService(masterUserId: string): Promise<void> {
    if (!this.syncManager) {
      throw new Error('SyncManager not initialized');
    }
    this.assetService = new AssetService(this.syncManager);
    await this.assetService.initialize(masterUserId);
  }

  private async initializeHistoryService(masterUserId: string): Promise<void> {
    if (!this.syncManager) {
      throw new Error('SyncManager not initialized');
    }
    this.historyService = new HistoryService(this.syncManager);
    await this.historyService.initialize(masterUserId);
  }

  private async initializeAuthService(_masterUserId: string): Promise<void> {
    // AuthService may not need a sync manager, instantiate directly
    this.authService = new AuthService();
    // AuthService doesn't have an initialize method, it's ready to use
  }

  private async initializeQuotaService(_masterUserId: string): Promise<void> {
    if (!this.syncManager) {
      throw new Error('SyncManager not initialized');
    }
    this.quotaService = new QuotaService(this.syncManager);
    // QuotaService doesn't have an initialize method, it's ready to use
  }

  private async initializePaymentService(_masterUserId: string): Promise<void> {
    // PaymentService may not need a sync manager, instantiate directly
    this.paymentService = new PaymentService();
    // PaymentService doesn't have an initialize method, it's ready to use
  }
}

// Export a single instance for global use
export const serviceManager = ServiceInitializationManager.getInstance();
import { AssetService } from './AssetService';
import { ContactService } from './ContactService';
import { GroupService } from './GroupService';
import { HistoryService } from './HistoryService';
import { TemplateService } from './TemplateService';

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
    return this.initializedServices.size === 5 && !this.isInitializing;
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
        // Initialize in dependency order
        await this.initializeService('template', () => this.initializeTemplateService(masterUserId));
        await this.initializeService('contact', () => this.initializeContactService(masterUserId));
        await this.initializeService('group', () => this.initializeGroupService(masterUserId));
        await this.initializeService('asset', () => this.initializeAssetService(masterUserId));
        await this.initializeService('history', () => this.initializeHistoryService(masterUserId));

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
    this.templateService = new TemplateService();
    await this.templateService.initialize(masterUserId);
  }

  private async initializeContactService(masterUserId: string): Promise<void> {
    this.contactService = new ContactService();
    await this.contactService.initialize(masterUserId);
  }

  private async initializeGroupService(masterUserId: string): Promise<void> {
    this.groupService = new GroupService();
    await this.groupService.initialize(masterUserId);
  }

  private async initializeAssetService(masterUserId: string): Promise<void> {
    this.assetService = new AssetService();
    await this.assetService.initialize(masterUserId);
  }

  private async initializeHistoryService(masterUserId: string): Promise<void> {
    this.historyService = new HistoryService();
    await this.historyService.initialize(masterUserId);
  }
}

// Export a single instance for global use
export const serviceManager = ServiceInitializationManager.getInstance();
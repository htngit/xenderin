import { ServiceInitializationManager } from './ServiceInitializationManager';

/**
 * Defines the structure for progress updates during the synchronization process.
 */
export interface SyncProgress {
  step: string;
  progress: number;
  status: 'syncing' | 'completed' | 'error';
  error?: string;
}

export class InitialSyncOrchestrator {
  private serviceManager: ServiceInitializationManager;

  /**
   * Creates an instance of InitialSyncOrchestrator.
   * @param serviceManager The ServiceInitializationManager instance containing initialized services
   */
  constructor(serviceManager: ServiceInitializationManager) {
    this.serviceManager = serviceManager;
  }

  /**
   * Performs the initial data synchronization for a first-time user.
   * It iterates through the core services and forces a sync with the remote data source,
   * reporting progress along the way.
   *
   * @param masterUserId The ID of the user for whom to sync data (unused as services are already initialized)
   * @param onProgress An optional callback function to report sync progress.
   */
  async performInitialSync(masterUserId: string, onProgress?: (progress: SyncProgress) => void): Promise<void> {
    // Verify that services are initialized before proceeding
    if (!this.serviceManager.isInitialized()) {
      throw new Error('Services must be initialized before performing initial sync');
    }

    // Get the already-initialized service instances
    const syncSteps = [
      { name: 'templates', service: this.serviceManager.getTemplateService() },
      { name: 'contacts', service: this.serviceManager.getContactService() },
      { name: 'assets', service: this.serviceManager.getAssetService() },
      { name: 'history', service: this.serviceManager.getHistoryService() }
    ];

    for (const [index, step] of syncSteps.entries()) {
      try {
        onProgress?.({
          step: step.name,
          progress: (index / syncSteps.length) * 100,
          status: 'syncing'
        });

        // Call forceSync on the already-initialized service
        await (step.service as any).forceSync();

        onProgress?.({
          step: step.name,
          progress: ((index + 1) / syncSteps.length) * 100,
          status: 'completed'
        });
      } catch (error: any) {
        console.error(`Initial sync failed for step '${step.name}':`, error);
        onProgress?.({
          step: step.name,
          progress: ((index + 1) / syncSteps.length) * 100,
          status: 'error',
          error: error.message || 'An unknown error occurred'
        });
        // Re-throw the error to halt the entire sync process on failure.
        throw new Error(`Sync failed during the '${step.name}' step.`);
      }
    }
  }
}
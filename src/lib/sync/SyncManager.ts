import { db, SyncOperation } from '../db';
import { supabase } from '../supabase';
import { userContextManager } from '../security/UserContextManager';
import {
  fromISOString,
  isValidTimestamp,
  compareTimestamps,
  normalizeTimestamp,
  nowISO
} from '../utils/timestamp';
import { validateData, logValidationError } from '../utils/validation';

// Sync status enum
export enum SyncStatus {
  IDLE = 'idle',
  SYNCING = 'syncing',
  ERROR = 'error',
  OFFLINE = 'offline',
  RECONNECTING = 'reconnecting'
}

// Conflict resolution strategies
export enum ConflictResolution {
  LOCAL_WINS = 'local_wins',      // Local changes take precedence
  REMOTE_WINS = 'remote_wins',    // Remote changes take precedence
  LAST_WRITE_WINS = 'last_write_wins', // Most recent change wins
  MANUAL = 'manual'               // User resolves manually
}

// Sync priority levels
export enum SyncPriority {
  CRITICAL = 'critical',    // Immediate sync required
  HIGH = 'high',           // High priority operations
  NORMAL = 'normal',       // Standard operations
  LOW = 'low',            // Background operations
  BACKGROUND = 'background' // Non-urgent background sync
}

// Sync event types
export interface SyncEvent {
  type: 'sync_start' | 'sync_complete' | 'sync_error' | 'conflict_detected' | 'status_change' | 'progress_update' | 'user_notification';
  table?: string;
  recordId?: string;
  status?: SyncStatus;
  message?: string;
  error?: Error;
  timestamp: Date;
  progress?: number;
  total?: number;
  notificationType?: 'info' | 'warning' | 'error' | 'success';
  userMessage?: string;
}

// Sync event listener
export type SyncEventListener = (event: SyncEvent) => void;

// Enhanced sync configuration
export interface SyncConfig {
  autoSync: boolean;
  baseSyncInterval: number; // Base interval in milliseconds
  maxRetries: number;
  conflictResolution: ConflictResolution;
  batchSize: number;
  maxQueueSize: number;
  cleanupInterval: number; // Cleanup interval in milliseconds
  connectionTimeout: number; // Connection timeout in milliseconds
  retryBackoffMultiplier: number; // Exponential backoff multiplier
  maxBackoffDelay: number; // Maximum backoff delay
  activityDetectionEnabled: boolean;
  backgroundSyncEnabled: boolean;
  compressionEnabled: boolean;
}

// Activity detection configuration
export interface ActivityConfig {
  userActionThreshold: number; // Time window for user actions (ms)
  syncIntervalMultiplier: number; // Multiplier for active users
  idleTimeout: number; // Time before considering user idle (ms)
  backgroundInterval: number; // Interval for background sync (ms)
}

// Conflict resolution result
export interface ConflictResolutionResult {
  resolved: boolean;
  winner: 'local' | 'remote' | 'merged';
  data: any;
  userNotification?: string;
  auditLog: string;
}

// Sync queue item with priority
export interface PrioritySyncOperation extends SyncOperation {
  priority: SyncPriority;
  estimatedSize: number; // Estimated data size for batching
  dependencies?: string[]; // Record IDs this operation depends on
}

// Performance metrics
export interface SyncMetrics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageSyncTime: number;
  lastSyncTime: Date;
  dataTransferred: number;
  compressionRatio: number;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'offline';
}

// Connection state
export interface ConnectionState {
  isOnline: boolean;
  quality: 'excellent' | 'good' | 'poor' | 'offline';
  lastCheck: Date;
  consecutiveFailures: number;
  averageLatency: number;
}

export class SyncManager {
  private eventListeners: SyncEventListener[] = [];
  private status: SyncStatus = SyncStatus.IDLE;
  private syncInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isOnline: boolean = navigator.onLine;
  private currentConfig: SyncConfig;
  private masterUserId: string | null = null;

  // Enhanced properties for new features
  private activityConfig: ActivityConfig;
  private connectionState: ConnectionState;
  private syncMetrics: SyncMetrics;
  private lastUserActivity: Date = new Date();
  private currentSyncInterval: number;
  private retryDelays: Map<string, number> = new Map(); // operationId -> delay
  private syncCache: Map<string, any> = new Map(); // Cache for frequently accessed data
  private compressionCache: Map<string, string> = new Map(); // Compressed data cache

  constructor(config?: Partial<SyncConfig>) {
    this.currentConfig = {
      autoSync: true,
      baseSyncInterval: 30000, // 30 seconds
      maxRetries: 3,
      conflictResolution: ConflictResolution.LAST_WRITE_WINS,
      batchSize: 50,
      maxQueueSize: 1000,
      cleanupInterval: 300000, // 5 minutes
      connectionTimeout: 10000, // 10 seconds
      retryBackoffMultiplier: 2,
      maxBackoffDelay: 300000, // 5 minutes
      activityDetectionEnabled: true,
      backgroundSyncEnabled: true,
      compressionEnabled: false,
      ...config
    };

    // Initialize activity configuration
    this.activityConfig = {
      userActionThreshold: 5000, // 5 seconds
      syncIntervalMultiplier: 0.5, // More frequent sync when active
      idleTimeout: 300000, // 5 minutes
      backgroundInterval: 300000 // 5 minutes for background
    };

    // Initialize connection state
    this.connectionState = {
      isOnline: navigator.onLine,
      quality: 'good',
      lastCheck: new Date(),
      consecutiveFailures: 0,
      averageLatency: 0
    };

    // Initialize sync metrics
    this.syncMetrics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageSyncTime: 0,
      lastSyncTime: new Date(0),
      dataTransferred: 0,
      compressionRatio: 1.0,
      connectionQuality: 'good'
    };

    // Initialize current sync interval
    this.currentSyncInterval = this.currentConfig.baseSyncInterval;

    this.setupOnlineDetection();
    this.setupActivityDetection();
    this.setupCleanupScheduler();
  }

  /**
   * Set the current master user ID for sync operations
   */
  setMasterUserId(masterUserId: string | null) {
    this.masterUserId = masterUserId;
  }

  /**
   * Get current online status
   * Centralized method for all services to check connectivity
   */
  public getIsOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Add event listener for sync events
   */
  addEventListener(listener: SyncEventListener) {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: SyncEventListener) {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Emit sync event to all listeners
   */
  private emit(event: Omit<SyncEvent, 'timestamp'>) {
    const fullEvent: SyncEvent = {
      ...event,
      timestamp: new Date()
    };

    this.eventListeners.forEach(listener => {
      try {
        listener(fullEvent);
      } catch (error) {
        console.error('Error in sync event listener:', error);
      }
    });
  }

  /**
   * Set sync status and emit event
   */
  private setStatus(status: SyncStatus, message?: string) {
    if (this.status !== status) {
      this.status = status;
      this.emit({
        type: 'status_change',
        status,
        message
      });
    }
  }

  /**
   * Setup online/offline detection with enhanced connection monitoring
   */
  private setupOnlineDetection() {
    const updateOnlineStatus = async () => {
      const wasOnline = this.isOnline;
      this.isOnline = navigator.onLine;

      if (wasOnline !== this.isOnline) {
        if (this.isOnline) {
          this.setStatus(SyncStatus.IDLE, 'Back online');
          await this.checkConnectionQuality();
          if (this.currentConfig.autoSync) {
            this.triggerSync();
          }
        } else {
          this.setStatus(SyncStatus.OFFLINE, 'Gone offline');
          this.connectionState.quality = 'offline';
        }
      }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Periodic connection quality checks
    setInterval(() => {
      if (this.isOnline) {
        this.checkConnectionQuality();
      }
    }, 60000); // Check every minute
  }

  /**
   * Setup activity detection for dynamic sync intervals
   */
  private setupActivityDetection() {
    if (!this.currentConfig.activityDetectionEnabled) return;

    // Track user activity
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    const updateActivity = () => {
      this.lastUserActivity = new Date();
      this.adjustSyncInterval();
    };

    activityEvents.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true });
    });

    // Periodic activity check
    setInterval(() => {
      this.adjustSyncInterval();
    }, 10000); // Check every 10 seconds
  }

  /**
   * Setup automatic cleanup scheduler
   */
  private setupCleanupScheduler() {
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.currentConfig.cleanupInterval);
  }

  /**
   * Check connection quality and update metrics
   */
  private async checkConnectionQuality(): Promise<void> {
    if (!this.isOnline) {
      this.connectionState.quality = 'offline';
      return;
    }

    try {
      const startTime = Date.now();
      // Simple connection test - check if we can reach Supabase
      const { error } = await supabase.from('profiles').select('count').limit(1).single();
      if (error) throw error;

      const latency = Date.now() - startTime;

      this.connectionState.lastCheck = new Date();
      this.connectionState.averageLatency = latency;
      this.connectionState.consecutiveFailures = 0;

      if (latency < 500) {
        this.connectionState.quality = 'excellent';
      } else if (latency < 2000) {
        this.connectionState.quality = 'good';
      } else {
        this.connectionState.quality = 'poor';
      }

      this.syncMetrics.connectionQuality = this.connectionState.quality;
    } catch (error) {
      console.error('Connection check failed:', error);
      this.connectionState.consecutiveFailures++;
      if (this.connectionState.consecutiveFailures > 3) {
        this.connectionState.quality = 'poor';
        this.syncMetrics.connectionQuality = 'poor';
      }
    }
  }

  /**
   * Adjust sync interval based on user activity and connection quality
   */
  private adjustSyncInterval(): void {
    if (!this.currentConfig.activityDetectionEnabled) return;

    const now = new Date();
    const timeSinceActivity = now.getTime() - this.lastUserActivity.getTime();
    const isActive = timeSinceActivity < this.activityConfig.idleTimeout;

    let newInterval = this.currentConfig.baseSyncInterval;

    if (isActive) {
      // More frequent sync when user is active
      newInterval = Math.max(
        5000, // Minimum 5 seconds
        this.currentConfig.baseSyncInterval * this.activityConfig.syncIntervalMultiplier
      );
    } else if (this.currentConfig.backgroundSyncEnabled) {
      // Less frequent sync when idle
      newInterval = this.activityConfig.backgroundInterval;
    }

    // Adjust for connection quality
    if (this.connectionState.quality === 'poor') {
      newInterval *= 2; // Double interval for poor connections
    } else if (this.connectionState.quality === 'excellent') {
      newInterval *= 0.8; // Slightly faster for excellent connections
    }

    if (newInterval !== this.currentSyncInterval) {
      this.currentSyncInterval = newInterval;
      this.restartAutoSync();
    }
  }

  /**
   * Restart auto sync with new interval
   */
  private restartAutoSync(): void {
    this.stopAutoSync();
    this.startAutoSync();
  }

  /**
   * Perform automatic cleanup of sync queue and cache
   */
  private async performCleanup(): Promise<void> {
    try {
      // Clean up old failed operations
      const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      await db.syncQueue
        .where('status').equals('failed')
        .and(item => fromISOString(item.timestamp) < cutoffDate)
        .delete();

      // Clean up old completed operations (keep last 1000)
      const completedOps = await db.syncQueue
        .where('status').equals('completed')
        .reverse()
        .sortBy('timestamp');

      if (completedOps.length > 1000) {
        const toDelete = completedOps.slice(1000);
        await db.syncQueue.bulkDelete(toDelete.map(op => op.id!));
      }

      // Clean up sync cache (remove items older than 1 hour)
      const cacheCutoff = Date.now() - 60 * 60 * 1000;
      for (const key of this.syncCache.keys()) {
        const value = this.syncCache.get(key);
        if (value && value.timestamp && value.timestamp < cacheCutoff) {
          this.syncCache.delete(key);
        }
      }

      // Clean up compression cache
      for (const [key, _value] of this.compressionCache.entries()) {
        // Keep compressed data for 30 minutes
        if (Date.now() - parseInt(key.split('_')[1] || '0') > 30 * 60 * 1000) {
          this.compressionCache.delete(key);
        }
      }

      console.log('Sync cleanup completed');
    } catch (error) {
      console.error('Error during sync cleanup:', error);
    }
  }

  /**
   * Start automatic sync with dynamic intervals
   */
  startAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    if (this.currentConfig.autoSync) {
      this.syncInterval = setInterval(() => {
        if (this.isOnline && this.masterUserId) {
          this.sync();
        }
      }, this.currentSyncInterval);
    }
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Manually trigger sync
   */
  async triggerSync(): Promise<void> {
    if (!this.isOnline) {
      this.setStatus(SyncStatus.OFFLINE, 'Cannot sync while offline');
      return;
    }

    if (!this.masterUserId) {
      throw new Error('Master user ID not set');
    }

    await this.sync();
  }

  /**
   * Enhanced main sync method with performance optimizations and retry logic
   */
  async sync(): Promise<void> {
    const syncStartTime = Date.now();
    this.setStatus(SyncStatus.SYNCING, 'Starting sync');

    try {
      // Use UserContextManager for in-memory auth check (no API call)
      const user = await userContextManager.getCurrentUser();

      if (!user) {
        console.warn('Sync skipped: User not authenticated');
        this.setStatus(SyncStatus.IDLE, 'Waiting for authentication');
        return;
      }

      // Get pending sync operations with priority sorting
      const pendingOps = await this.getPrioritizedSyncOperations();

      if (pendingOps.length === 0) {
        this.setStatus(SyncStatus.IDLE, 'No changes to sync');
        return;
      }

      this.emit({
        type: 'sync_start',
        message: `Syncing ${pendingOps.length} operations`,
        total: pendingOps.length
      });

      // Process operations in optimized batches with progress tracking
      let processedCount = 0;
      for (let i = 0; i < pendingOps.length; i += this.currentConfig.batchSize) {
        const batch = pendingOps.slice(i, i + this.currentConfig.batchSize);
        await this.processBatchWithRetry(batch);

        processedCount += batch.length;
        this.emit({
          type: 'progress_update',
          progress: processedCount,
          total: pendingOps.length,
          message: `Processed ${processedCount}/${pendingOps.length} operations`
        });
      }

      // Pull updates from server with caching
      await this.pullFromServerWithCache();

      // Update sync metrics
      const syncDuration = Date.now() - syncStartTime;
      this.updateSyncMetrics(syncDuration, pendingOps.length);

      this.setStatus(SyncStatus.IDLE, 'Sync completed');

      this.emit({
        type: 'sync_complete',
        message: `Sync completed successfully in ${syncDuration}ms`,
        total: pendingOps.length
      });

    } catch (error) {
      const syncDuration = Date.now() - syncStartTime;
      console.error(`Sync error (duration: ${syncDuration}ms):`, error);
      this.syncMetrics.failedOperations++;

      // Determine if this is a recoverable error
      const isRecoverable = this.isRecoverableError(error);

      if (isRecoverable && this.connectionState.consecutiveFailures < 3) {
        this.setStatus(SyncStatus.RECONNECTING, 'Sync failed, will retry');
        // Schedule retry with exponential backoff
        setTimeout(() => {
          if (this.isOnline) {
            this.sync();
          }
        }, this.getRetryDelay());
      } else {
        this.setStatus(SyncStatus.ERROR, error instanceof Error ? error.message : 'Sync failed');
      }

      this.emit({
        type: 'sync_error',
        error: error instanceof Error ? error : new Error('Unknown sync error'),
        message: isRecoverable ? 'Sync failed, will retry automatically' : 'Sync failed permanently'
      });
    }
  }

  /**
   * Get prioritized sync operations
   */
  private async getPrioritizedSyncOperations(): Promise<PrioritySyncOperation[]> {
    const pendingOps = await db.getPendingSyncOperations();

    // Convert to priority operations and sort by priority
    const prioritizedOps: PrioritySyncOperation[] = pendingOps.map(op => ({
      ...op,
      priority: this.determineOperationPriority(op),
      estimatedSize: this.estimateOperationSize(op),
      dependencies: []
    }));

    // Sort by priority (critical first) and then by timestamp
    return prioritizedOps.sort((a, b) => {
      if (a.priority !== b.priority) {
        const priorityOrder = {
          [SyncPriority.CRITICAL]: 0,
          [SyncPriority.HIGH]: 1,
          [SyncPriority.NORMAL]: 2,
          [SyncPriority.LOW]: 3,
          [SyncPriority.BACKGROUND]: 4
        };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return compareTimestamps(a.timestamp, b.timestamp);
    });
  }

  /**
   * Determine operation priority based on operation type and data
   */
  private determineOperationPriority(operation: SyncOperation): SyncPriority {
    // Critical operations that affect user experience
    if (operation.operation === 'delete' ||
      (operation.table === 'quotas' && operation.operation === 'update')) {
      return SyncPriority.CRITICAL;
    }

    // High priority for user-initiated changes
    if (operation.table === 'contacts' || operation.table === 'templates') {
      return SyncPriority.HIGH;
    }

    // Normal priority for most operations
    if (operation.table === 'activityLogs' || operation.table === 'groups') {
      return SyncPriority.NORMAL;
    }

    // Low priority for background data
    return SyncPriority.LOW;
  }

  /**
   * Estimate operation size for batching optimization
   */
  private estimateOperationSize(operation: SyncOperation): number {
    const baseSize = 100; // Base size for operation metadata
    const dataSize = JSON.stringify(operation.data || {}).length;
    return baseSize + dataSize;
  }

  /**
   * Check if error is recoverable
   */
  private isRecoverableError(error: any): boolean {
    if (!error) return false;

    const errorMessage = error.message || error.toString();

    // Network-related errors are recoverable
    const recoverablePatterns = [
      'network',
      'timeout',
      'connection',
      'offline',
      'fetch',
      'ECONNREFUSED',
      'ENOTFOUND'
    ];

    return recoverablePatterns.some(pattern =>
      errorMessage.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Get retry delay with exponential backoff
   */
  private getRetryDelay(): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = this.currentConfig.maxBackoffDelay;
    const backoffMultiplier = this.currentConfig.retryBackoffMultiplier;

    const delay = Math.min(
      baseDelay * Math.pow(backoffMultiplier, this.connectionState.consecutiveFailures),
      maxDelay
    );

    return delay;
  }

  /**
   * Update sync metrics after successful sync
   */
  private updateSyncMetrics(syncDuration: number, operationsCount: number): void {
    this.syncMetrics.lastSyncTime = new Date();
    this.syncMetrics.averageSyncTime =
      (this.syncMetrics.averageSyncTime + syncDuration) / 2;
    this.syncMetrics.totalOperations += operationsCount;
  }

  /**
   * Process a batch of sync operations with enhanced retry logic
   */
  private async processBatchWithRetry(operations: PrioritySyncOperation[]): Promise<void> {
    const results = await Promise.allSettled(
      operations.map(operation => this.processOperationWithRetry(operation))
    );

    // Log batch results
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    if (failed > 0) {
      console.warn(`Batch processing: ${successful} successful, ${failed} failed`);
    }
  }

  /**
   * Process a single operation with retry logic and exponential backoff
   */
  private async processOperationWithRetry(operation: PrioritySyncOperation): Promise<void> {
    const operationId = `${operation.table}_${operation.recordId}_${operation.operation}`;
    let lastError: any;

    for (let attempt = 0; attempt <= this.currentConfig.maxRetries; attempt++) {
      try {
        await this.processOperation(operation);

        // Mark operation as completed
        await db.syncQueue.update(operation.id!, {
          status: 'completed',
          lastAttempt: nowISO()
        });

        // Clear retry delay on success
        this.retryDelays.delete(operationId);
        return;

      } catch (error) {
        lastError = error;
        console.error(`Error processing operation ${operation.id} (attempt ${attempt + 1}):`, error);

        if (attempt < this.currentConfig.maxRetries) {
          // Calculate delay with exponential backoff
          const delay = Math.min(
            1000 * Math.pow(this.currentConfig.retryBackoffMultiplier, attempt),
            this.currentConfig.maxBackoffDelay
          );

          this.retryDelays.set(operationId, delay);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed - mark as failed
    await db.syncQueue.update(operation.id!, {
      status: 'failed',
      error: lastError instanceof Error ? lastError.message : 'Unknown error',
      retryCount: this.currentConfig.maxRetries,
      lastAttempt: nowISO()
    });

    throw lastError;
  }

  /**
   * Process a single sync operation
   */
  private async processOperation(operation: SyncOperation): Promise<void> {
    const table = operation.table;
    const recordId = operation.recordId;

    switch (operation.operation) {
      case 'create':
        await this.pushCreate(table, recordId, operation.data);
        break;
      case 'update':
        await this.pushUpdate(table, recordId, operation.data);
        break;
      case 'delete':
        await this.pushDelete(table, recordId);
        break;
      default:
        throw new Error(`Unknown operation: ${operation.operation}`);
    }

    // Update local record sync status
    const localTable = db.table(table as any);
    if (operation.operation !== 'delete') {
      await localTable.update(recordId, {
        _syncStatus: 'synced'
      });
    }
  }

  /**
   * Push create operation to server
   */
  private async pushCreate(table: string, _recordId: string, data: any): Promise<void> {
    const supabaseTable = this.mapTableName(table);

    // Remove sync metadata before sending to server
    const { _syncStatus, _lastModified, _version, _deleted, _compressed, _compressionKey, assets, ...serverData } = data;

    // Filter out legacy/local-only fields for assets table
    if (table === 'assets') {
      delete (serverData as any).size;
      delete (serverData as any).type;
      delete (serverData as any).url;
      delete (serverData as any).uploadDate;
    }

    // Validate critical fields for assets
    if (table === 'assets') {
      if (!serverData.master_user_id) {
        console.error('CRITICAL: master_user_id is missing for asset!', {
          recordId: _recordId,
          serverData,
          originalData: data
        });
        throw new Error('master_user_id is required for assets');
      }
      console.log('Pushing asset to Supabase:', {
        id: serverData.id,
        master_user_id: serverData.master_user_id,
        file_name: serverData.file_name
      });
    }

    // Use upsert for assets to handle potential duplicates from race conditions
    if (table === 'assets') {
      const { error } = await supabase
        .from(supabaseTable)
        .upsert(serverData, { onConflict: 'id' });

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from(supabaseTable)
        .insert(serverData);

      if (error) throw error;
    }
  }

  /**
   * Push update operation to server
   */
  private async pushUpdate(table: string, recordId: string, data: any): Promise<void> {
    const supabaseTable = this.mapTableName(table);

    // Remove sync metadata before sending to server
    const { _syncStatus, _lastModified, _version, _deleted, _compressed, _compressionKey, assets, ...serverData } = data;
    serverData.updated_at = nowISO();

    // Filter out legacy/local-only fields for assets table
    if (table === 'assets') {
      delete (serverData as any).size;
      delete (serverData as any).type;
      delete (serverData as any).url;
      delete (serverData as any).uploadDate;
    }

    const { error } = await supabase
      .from(supabaseTable)
      .update(serverData)
      .eq('id', recordId);

    if (error) throw error;
  }

  /**
   * Push delete operation to server
   */
  private async pushDelete(table: string, recordId: string): Promise<void> {
    const supabaseTable = this.mapTableName(table);

    const { error } = await supabase
      .from(supabaseTable)
      .delete()
      .eq('id', recordId);

    if (error) throw error;
  }

  /**
   * Pull updates from server with caching and compression
   */
  private async pullFromServerWithCache(): Promise<void> {
    if (!this.masterUserId) return;

    const tables = db.getSyncableTables();
    const cacheKey = `pull_cache_${this.masterUserId}_${Date.now()}`;

    try {
      // Check cache first for recent pulls
      const cachedData = this.syncCache.get(cacheKey);
      if (cachedData && (Date.now() - cachedData.timestamp) < 30000) { // 30 second cache
        console.log('Using cached pull data');
        return;
      }

      // Pull from each table with parallel processing for better performance
      const pullPromises = tables.map(tableName => this.pullTableFromServer(tableName));
      await Promise.allSettled(pullPromises);

      // Cache successful pull
      this.syncCache.set(cacheKey, {
        timestamp: Date.now(),
        data: { tables, timestamp: new Date() }
      });

      // Limit cache size
      if (this.syncCache.size > 10) {
        const oldestKey = this.syncCache.keys().next().value;
        if (oldestKey) {
          this.syncCache.delete(oldestKey);
        }
      }

    } catch (error) {
      console.error('Error in pullFromServerWithCache:', error);
      // Continue without caching on error
    }
  }

  /**
   * Resolve conflicts between local and remote data with intelligent timestamp comparison
   */
  private async resolveConflict(
    tableName: string,
    recordId: string,
    localData: any,
    remoteData: any
  ): Promise<ConflictResolutionResult> {
    try {
      // Validate timestamps
      const localTimestamp = this.validateAndNormalizeTimestamp(localData._lastModified || localData.updated_at);
      const remoteTimestamp = this.validateAndNormalizeTimestamp(remoteData.updated_at);

      if (!localTimestamp || !remoteTimestamp) {
        // If timestamps are invalid, prefer remote data for safety
        return {
          resolved: true,
          winner: 'remote',
          data: remoteData,
          userNotification: 'Data conflict resolved automatically due to invalid timestamps',
          auditLog: `Conflict resolved for ${tableName}:${recordId} - invalid timestamps, chose remote`
        };
      }

      // Compare timestamps
      const comparison = compareTimestamps(localTimestamp, remoteTimestamp);

      let winner: 'local' | 'remote' | 'merged';
      let finalData: any;
      let userMessage = '';
      let auditMessage = '';

      switch (this.currentConfig.conflictResolution) {
        case ConflictResolution.LAST_WRITE_WINS:
          if (comparison > 0) {
            // Local is newer
            winner = 'local';
            finalData = localData;
            auditMessage = `Last-write-wins: local data chosen (${localTimestamp} > ${remoteTimestamp})`;
          } else if (comparison < 0) {
            // Remote is newer
            winner = 'remote';
            finalData = remoteData;
            auditMessage = `Last-write-wins: remote data chosen (${remoteTimestamp} > ${localTimestamp})`;
          } else {
            // Same timestamp - merge if possible
            winner = 'merged';
            finalData = this.mergeData(localData, remoteData);
            auditMessage = `Last-write-wins: data merged (same timestamp)`;
          }
          break;

        case ConflictResolution.REMOTE_WINS:
          winner = 'remote';
          finalData = remoteData;
          auditMessage = `Remote-wins strategy: remote data chosen`;
          break;

        case ConflictResolution.LOCAL_WINS:
          winner = 'local';
          finalData = localData;
          auditMessage = `Local-wins strategy: local data chosen`;
          break;

        case ConflictResolution.MANUAL:
          // For manual resolution, emit event and keep local data for now
          winner = 'local';
          finalData = localData;
          userMessage = `Conflict detected in ${tableName}. Please review and resolve manually.`;
          auditMessage = `Manual resolution required for ${tableName}:${recordId}`;
          break;

        default:
          winner = 'remote';
          finalData = remoteData;
          auditMessage = `Default strategy: remote data chosen`;
      }

      // Log significant conflicts
      if (Math.abs(comparison) > 300000) { // More than 5 minutes difference
        userMessage = userMessage || `Significant data conflict resolved in ${tableName}.`;
        console.warn(`Significant conflict detected: ${auditMessage}`);
      }

      return {
        resolved: true,
        winner,
        data: finalData,
        userNotification: userMessage,
        auditLog: auditMessage
      };

    } catch (error) {
      console.error('Error resolving conflict:', error);
      // Fallback to remote wins on error
      return {
        resolved: true,
        winner: 'remote',
        data: remoteData,
        userNotification: 'Conflict resolution failed, using server data',
        auditLog: `Conflict resolution error for ${tableName}:${recordId}, fell back to remote`
      };
    }
  }

  /**
   * Validate and normalize timestamp with comprehensive error handling
   */
  private validateAndNormalizeTimestamp(timestamp: any): string | null {
    try {
      if (!timestamp) {
        console.warn('Timestamp is null or undefined');
        return null;
      }

      // Try to normalize the timestamp
      const normalized = normalizeTimestamp(timestamp);

      // Validate the normalized timestamp
      if (!isValidTimestamp(normalized)) {
        console.error(`Invalid timestamp after normalization: ${timestamp} -> ${normalized}`);
        return null;
      }

      return normalized;
    } catch (error) {
      console.error('Error validating timestamp:', error, 'Input:', timestamp);
      return null;
    }
  }

  /**
   * Merge data from local and remote sources
   */
  private mergeData(localData: any, remoteData: any): any {
    // Simple merge strategy: remote data takes precedence for server-controlled fields,
    // local data preserved for user-specific fields
    const merged = { ...remoteData };

    // Preserve local sync metadata
    if (localData._syncStatus) merged._syncStatus = localData._syncStatus;
    if (localData._lastModified) merged._lastModified = localData._lastModified;
    if (localData._version) merged._version = Math.max(localData._version || 0, remoteData._version || 0) + 1;

    // For certain fields, prefer local data if it exists and remote doesn't
    const preferLocalFields = ['notes', 'tags', 'is_blocked'];
    preferLocalFields.forEach(field => {
      if (localData[field] && !remoteData[field]) {
        merged[field] = localData[field];
      }
    });

    return merged;
  }

  /**
   * Pull updates for a specific table from server
   */
  private async pullTableFromServer(tableName: string): Promise<void> {
    const supabaseTable = this.mapTableName(tableName);
    const localTable = db.table(tableName as any);

    // Get last sync timestamp for this table
    const lastSync = await this.getLastSyncTime(tableName);

    // Use appropriate timestamp field based on table
    let timestampField = 'updated_at';
    if (tableName === 'userSessions') {
      // user_sessions table uses last_active or created_at instead of updated_at
      timestampField = 'last_active'; // Prefer last_active for user sessions
    }

    // Fetch updated records from server
    const { data: serverRecords, error } = await supabase
      .from(supabaseTable)
      .select('*')
      .eq('master_user_id', this.masterUserId)
      .gte(timestampField, lastSync);

    if (error) throw error;
    if (!serverRecords || serverRecords.length === 0) return;

    // Process each server record with enhanced conflict resolution
    for (const serverRecord of serverRecords) {
      try {
        // Ensure server record timestamps are in consistent ISO string format
        const normalizedServerRecord = this.normalizeServerRecordTimestamps(serverRecord);

        const localRecord = await localTable.get(normalizedServerRecord.id);

        if (!localRecord) {
          // New record from server - add to local with validation
          const validatedData = validateData(normalizedServerRecord, tableName as any);
          if (validatedData) {
            const localRecord = {
              ...validatedData,
              _syncStatus: 'synced' as const,
              _lastModified: nowISO(),
              _version: 1,
              _deleted: false
            };
            await localTable.add(localRecord);
            this.syncMetrics.totalOperations++;
            this.syncMetrics.successfulOperations++;
          } else {
            console.error(`Validation failed for new server record ${normalizedServerRecord.id} in ${tableName}`);
            this.syncMetrics.failedOperations++;
          }
        } else {
          // Check for conflicts using enhanced resolution
          const conflictResult = await this.resolveConflict(tableName, normalizedServerRecord.id, localRecord, normalizedServerRecord);

          if (conflictResult.resolved) {
            // Apply resolved data with normalized timestamps
            const updatedRecord = {
              ...this.normalizeServerRecordTimestamps(conflictResult.data),
              _syncStatus: 'synced' as const,
              _lastModified: nowISO(),
              _version: (localRecord._version || 0) + 1,
              _deleted: false
            };

            await localTable.update(normalizedServerRecord.id, updatedRecord);
            this.syncMetrics.totalOperations++;
            this.syncMetrics.successfulOperations++;

            // Emit conflict event if manual resolution is needed
            if (this.currentConfig.conflictResolution === ConflictResolution.MANUAL) {
              this.emit({
                type: 'conflict_detected',
                table: tableName,
                recordId: normalizedServerRecord.id,
                message: conflictResult.userNotification || `Conflict detected for record ${normalizedServerRecord.id} in ${tableName}`
              });
            }

            // Emit user notification for significant conflicts
            if (conflictResult.userNotification) {
              this.emit({
                type: 'user_notification',
                table: tableName,
                recordId: normalizedServerRecord.id,
                message: conflictResult.userNotification,
                notificationType: 'warning',
                userMessage: conflictResult.userNotification
              });
            }

            // Log audit information
            console.log(`Conflict resolved: ${conflictResult.auditLog}`);
          } else {
            console.error(`Failed to resolve conflict for ${tableName}:${normalizedServerRecord.id}`);
            this.syncMetrics.failedOperations++;
          }
        }
      } catch (error) {
        console.error(`Error processing server record ${serverRecord.id} in ${tableName}:`, error);
        this.syncMetrics.failedOperations++;
      }
    }

    // Update last sync time
    await this.setLastSyncTime(tableName, nowISO());
  }

  /**
   * Get last sync time for a table
   */
  private async getLastSyncTime(tableName: string): Promise<string> {
    const key = `last_sync_${tableName}`;
    const stored = localStorage.getItem(key);
    return stored ? stored : new Date(0).toISOString();
  }

  /**
   * Set last sync time for a table
   */
  private async setLastSyncTime(tableName: string, date: string): Promise<void> {
    const key = `last_sync_${tableName}`;
    localStorage.setItem(key, date);
  }

  /**
   * Normalize server record timestamps to ensure consistent ISO string format
   */
  private normalizeServerRecordTimestamps(record: any): any {
    if (!record || typeof record !== 'object') {
      return record;
    }

    const normalized = { ...record };

    // List of all timestamp fields that need normalization
    const timestampFields = [
      'created_at', 'updated_at', 'uploadDate', 'started_at', 'completed_at',
      'scheduled_for', 'reset_date', 'expires_at', 'last_interaction',
      'committed_at', 'payment_date', 'last_active'
    ];

    // Normalize each timestamp field to ISO string format
    timestampFields.forEach(field => {
      if (normalized[field]) {
        try {
          normalized[field] = normalizeTimestamp(normalized[field]);
        } catch (error) {
          console.warn(`Failed to normalize timestamp field ${field}:`, error);
          // Keep original value if normalization fails
        }
      }
    });

    return normalized;
  }

  /**
   * Map local table names to Supabase table names
   * FIXED: Corrected table mappings to match actual Supabase schema
   */
  private mapTableName(tableName: string): string {
    const mapping: Record<string, string> = {
      contacts: 'contacts',
      groups: 'groups',                    // FIXED: was 'contact_groups'
      templates: 'templates',
      activityLogs: 'history',             // Supabase table is 'history', not 'activity_logs'
      assets: 'assets',
      quotas: 'user_quotas',               // FIXED: was 'quotas'
      profiles: 'profiles',
      payments: 'payments',
      quotaReservations: 'quota_reservations',
      userSessions: 'user_sessions'
    };

    return mapping[tableName] || tableName;
  }

  /**
   * Enhanced add operation to sync queue with priority and compression support
   */
  async addToSyncQueue(
    table: string,
    operation: 'create' | 'update' | 'delete',
    recordId: string,
    data: any,
    priority: SyncPriority = SyncPriority.NORMAL
  ): Promise<void> {
    // Validate data before queuing
    const validatedData = validateData(data, table as any);
    if (!validatedData) {
      logValidationError('sync_queue', table, data, new Error('Validation failed'));
      throw new Error(`Invalid data for ${table} sync operation`);
    }

    // Compress data if enabled
    let processedData = validatedData;
    if (this.currentConfig.compressionEnabled && operation !== 'delete') {
      processedData = await this.compressData(validatedData);
    }

    const syncOperation: SyncOperation = {
      table,
      operation,
      recordId,
      data: processedData,
      timestamp: nowISO(),
      retryCount: 0,
      status: 'pending'
    };

    await db.syncQueue.add(syncOperation);

    // Update activity timestamp for dynamic sync intervals
    this.lastUserActivity = new Date();

    // Trigger immediate sync for critical operations
    if (priority === SyncPriority.CRITICAL && this.isOnline) {
      setTimeout(() => this.triggerSync(), 100);
    }
  }

  /**
   * Compress data for efficient sync
   */
  private async compressData(data: any): Promise<any> {
    try {
      const jsonString = JSON.stringify(data);
      // Simple compression - in production, use a proper compression library
      const compressed = btoa(jsonString); // Base64 encoding as simple compression
      const compressionKey = `compressed_${Date.now()}_${Math.random()}`;

      this.compressionCache.set(compressionKey, compressed);
      this.syncMetrics.compressionRatio = (this.syncMetrics.compressionRatio + (jsonString.length / compressed.length)) / 2;

      return { _compressed: true, _compressionKey: compressionKey };
    } catch (error) {
      console.warn('Compression failed, using original data:', error);
      return data;
    }
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    return this.status;
  }

  /**

  /**
   * Get comprehensive sync statistics and metrics
   */
  async getSyncStats() {
    const unsyncedCounts = await db.getUnsyncedCount();
    const pendingOps = await db.getPendingSyncOperations();

    return {
      status: this.status,
      isOnline: this.isOnline,
      connectionQuality: this.connectionState.quality,
      unsyncedCounts,
      pendingOperations: pendingOps.length,
      totalPending: pendingOps.reduce((sum, _) => sum + 1, 0),
      metrics: {
        ...this.syncMetrics,
        cacheSize: this.syncCache.size,
        compressionCacheSize: this.compressionCache.size,
        activeRetries: this.retryDelays.size,
        currentSyncInterval: this.currentSyncInterval
      },
      activity: {
        lastUserActivity: this.lastUserActivity,
        isActive: (Date.now() - this.lastUserActivity.getTime()) < this.activityConfig.idleTimeout
      },
      queueHealth: {
        size: await db.syncQueue.count(),
        maxSize: this.currentConfig.maxQueueSize,
        healthPercentage: Math.min(100, (await db.syncQueue.where('status').equals('failed').count() / Math.max(1, await db.syncQueue.count())) * 100)
      }
    };
  }

  /**
   * Get detailed sync logs for debugging
   */
  getSyncLogs(_limit: number = 50): SyncEvent[] {
    // In a real implementation, this would store logs in a circular buffer
    // For now, return empty array as logs are handled via events
    return [];
  }

  /**
   * Force cleanup of sync queue (admin function)
   */
  async forceCleanup(): Promise<void> {
    await this.performCleanup();
    console.log('Forced cleanup completed');
  }

  /**
   * Reset sync metrics
   */
  resetMetrics(): void {
    this.syncMetrics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageSyncTime: 0,
      lastSyncTime: new Date(0),
      dataTransferred: 0,
      compressionRatio: 1.0,
      connectionQuality: this.connectionState.quality
    };
  }

  /**
   * Perform partial sync of specified tables with percentage limit
   */
  async partialSync(tables: string[], percentage: number = 0.5): Promise<void> {
    if (!this.isOnline) {
      this.setStatus(SyncStatus.OFFLINE, 'Cannot sync while offline');
      return;
    }

    if (!this.masterUserId) {
      throw new Error('Master user ID not set');
    }

    const syncStartTime = Date.now();
    this.setStatus(SyncStatus.SYNCING, `Starting partial sync for ${tables.length} tables at ${percentage * 100}%`);

    try {
      this.emit({
        type: 'sync_start',
        message: `Partial sync of ${tables.length} tables at ${percentage * 100}%`,
        total: tables.length
      });

      let completedTables = 0;
      for (const tableName of tables) {
        try {
          // Calculate record limit based on percentage
          const recordLimit = percentage >= 1.0 ?
            undefined :
            await this.calculateRecordLimit(tableName, percentage);

          await this.pullTableFromServerWithLimit(tableName, recordLimit);

          completedTables++;
          this.emit({
            type: 'progress_update',
            progress: completedTables,
            total: tables.length,
            message: `Processed ${completedTables}/${tables.length} tables`
          });
        } catch (tableError) {
          console.error(`Error syncing table ${tableName}:`, tableError);
          // Continue with other tables instead of stopping the entire sync
        }
      }

      const syncDuration = Date.now() - syncStartTime;
      this.updateSyncMetrics(syncDuration, completedTables);

      this.setStatus(SyncStatus.IDLE, 'Partial sync completed');

      this.emit({
        type: 'sync_complete',
        message: `Partial sync completed in ${syncDuration}ms for ${completedTables}/${tables.length} tables`,
        total: completedTables
      });
    } catch (error) {
      const syncDuration = Date.now() - syncStartTime;
      console.error(`Partial sync error (duration: ${syncDuration}ms):`, error);
      this.setStatus(SyncStatus.ERROR, error instanceof Error ? error.message : 'Partial sync failed');

      this.emit({
        type: 'sync_error',
        error: error instanceof Error ? error : new Error('Unknown sync error'),
        message: 'Partial sync failed'
      });
    }
  }

  /**
   * Calculate record limit for partial sync based on percentage
   */
  private async calculateRecordLimit(tableName: string, percentage: number): Promise<number> {
    // For different tables, we might want to prioritize different records
    // For example, prioritize recently used contacts or frequently used templates
    let totalRecords = 0;

    const localTable = db.table(tableName as any);
    totalRecords = await localTable.count();

    // If there are no records locally, fetch some from the server
    if (totalRecords === 0) {
      // Fetch count from server
      const supabaseTable = this.mapTableName(tableName);
      const { count, error } = await supabase
        .from(supabaseTable)
        .select('id', { count: 'exact', head: true })
        .eq('master_user_id', this.masterUserId);

      if (error) {
        console.error(`Error counting records in ${tableName}:`, error);
        // Default to 100 records if we can't get the count
        return Math.max(1, Math.floor(100 * percentage));
      }

      totalRecords = count || 0;
    }

    const recordLimit = Math.max(1, Math.floor(totalRecords * percentage));

    // For certain tables, we might want to adjust the limit based on importance
    switch (tableName) {
      case 'contacts':
        // Prioritize most recently used contacts
        return Math.min(recordLimit, 1000); // Cap at 1000 for contacts
      case 'templates':
        // Prioritize most used templates
        return Math.min(recordLimit, 500); // Cap at 500 for templates
      case 'assets':
        // Prioritize more recent assets (may be larger files)
        return Math.min(recordLimit, 100); // Cap at 100 for assets to avoid large downloads
      default:
        return Math.min(recordLimit, 500); // General cap
    }
  }

  /**
   * Pull updates for a specific table from server with record limit
   */
  private async pullTableFromServerWithLimit(tableName: string, recordLimit?: number): Promise<void> {
    const supabaseTable = this.mapTableName(tableName);
    const localTable = db.table(tableName as any);

    // Get last sync timestamp for this table
    const lastSync = await this.getLastSyncTime(tableName);

    // Use appropriate timestamp field based on table
    let timestampField = 'updated_at';
    if (tableName === 'userSessions') {
      // user_sessions table uses last_active or created_at instead of updated_at
      timestampField = 'last_active'; // Prefer last_active for user sessions
    }

    // Fetch updated records from server with optional limit
    let query = supabase
      .from(supabaseTable)
      .select('*')
      .eq('master_user_id', this.masterUserId)
      .gte(timestampField, lastSync);

    if (recordLimit) {
      query = query.limit(recordLimit);
    }

    const { data: serverRecords, error } = await query;

    if (error) throw error;
    if (!serverRecords || serverRecords.length === 0) return;

    // Process each server record with enhanced conflict resolution
    for (const serverRecord of serverRecords) {
      try {
        // Ensure server record timestamps are in consistent ISO string format
        const normalizedServerRecord = this.normalizeServerRecordTimestamps(serverRecord);

        const localRecord = await localTable.get(normalizedServerRecord.id);

        if (!localRecord) {
          // New record from server - add to local with validation
          const validatedData = validateData(normalizedServerRecord, tableName as any);
          if (validatedData) {
            const localRecord = {
              ...validatedData,
              _syncStatus: 'synced' as const,
              _lastModified: nowISO(),
              _version: 1,
              _deleted: false
            };
            await localTable.add(localRecord);
            this.syncMetrics.totalOperations++;
            this.syncMetrics.successfulOperations++;
          } else {
            console.error(`Validation failed for new server record ${normalizedServerRecord.id} in ${tableName}`);
            this.syncMetrics.failedOperations++;
          }
        } else {
          // Check for conflicts using enhanced resolution
          const conflictResult = await this.resolveConflict(tableName, normalizedServerRecord.id, localRecord, normalizedServerRecord);

          if (conflictResult.resolved) {
            // Apply resolved data with normalized timestamps
            const updatedRecord = {
              ...this.normalizeServerRecordTimestamps(conflictResult.data),
              _syncStatus: 'synced' as const,
              _lastModified: nowISO(),
              _version: (localRecord._version || 0) + 1,
              _deleted: false
            };

            await localTable.update(normalizedServerRecord.id, updatedRecord);
            this.syncMetrics.totalOperations++;
            this.syncMetrics.successfulOperations++;

            // Emit user notification for significant conflicts
            if (conflictResult.userNotification) {
              this.emit({
                type: 'user_notification',
                table: tableName,
                recordId: normalizedServerRecord.id,
                message: conflictResult.userNotification,
                notificationType: 'warning',
                userMessage: conflictResult.userNotification
              });
            }

            // Log audit information
            console.log(`Conflict resolved: ${conflictResult.auditLog}`);
          } else {
            console.error(`Failed to resolve conflict for ${tableName}:${normalizedServerRecord.id}`);
            this.syncMetrics.failedOperations++;
          }
        }
      } catch (error) {
        console.error(`Error processing server record ${serverRecord.id} in ${tableName}:`, error);
        this.syncMetrics.failedOperations++;
      }
    }

    // Update last sync time
    await this.setLastSyncTime(tableName, nowISO());
  }

  /**
   * Continue sync in background for remaining records
   */
  async backgroundSync(tables: string[]): Promise<void> {
    if (!this.isOnline) {
      console.log('Skipping background sync - offline');
      return;
    }

    if (!this.masterUserId) {
      console.log('Skipping background sync - no master user ID');
      return;
    }

    console.log(`Starting background sync for ${tables.length} tables`);
    this.emit({
      type: 'sync_start',
      message: `Background sync for ${tables.length} tables`,
      notificationType: 'info'
    });

    // Run in background without blocking UI
    setTimeout(async () => {
      try {
        this.setStatus(SyncStatus.SYNCING, 'Background sync in progress');

        let completedTables = 0;
        for (const tableName of tables) {
          try {
            await this.pullRemainingRecords(tableName);
            completedTables++;
          } catch (tableError) {
            console.error(`Error in background sync for table ${tableName}:`, tableError);
          }
        }

        this.setStatus(SyncStatus.IDLE, 'Background sync completed');
        console.log(`Background sync completed for ${completedTables}/${tables.length} tables`);

        this.emit({
          type: 'sync_complete',
          message: `Background sync completed for ${completedTables} tables`,
          notificationType: 'success'
        });
      } catch (error) {
        console.error('Background sync error:', error);
        this.emit({
          type: 'sync_error',
          error: error instanceof Error ? error : new Error('Background sync failed'),
          message: 'Background sync failed',
          notificationType: 'error'
        });
      }
    }, 0); // Use setTimeout to yield to main thread
  }

  /**
   * Pull remaining records for a table that weren't synced in partial sync
   */
  private async pullRemainingRecords(tableName: string): Promise<void> {
    const supabaseTable = this.mapTableName(tableName);
    const localTable = db.table(tableName as any);

    // Get last sync timestamp for this table
    const lastSync = await this.getLastSyncTime(tableName);

    // Use appropriate timestamp field based on table
    let timestampField = 'updated_at';
    if (tableName === 'userSessions') {
      // user_sessions table uses last_active or created_at instead of updated_at
      timestampField = 'last_active'; // Prefer last_active for user sessions
    }

    // Fetch records from server that haven't been synced yet
    const { data: serverRecords, error } = await supabase
      .from(supabaseTable)
      .select('*')
      .eq('master_user_id', this.masterUserId)
      .gte(timestampField, lastSync);

    if (error) throw error;
    if (!serverRecords || serverRecords.length === 0) return;

    // Process each server record
    for (const serverRecord of serverRecords) {
      try {
        // Ensure server record timestamps are in consistent ISO string format
        const normalizedServerRecord = this.normalizeServerRecordTimestamps(serverRecord);

        const localRecord = await localTable.get(normalizedServerRecord.id);

        if (!localRecord) {
          // New record from server - add to local with validation
          const validatedData = validateData(normalizedServerRecord, tableName as any);
          if (validatedData) {
            const localRecord = {
              ...validatedData,
              _syncStatus: 'synced' as const,
              _lastModified: nowISO(),
              _version: 1,
              _deleted: false
            };
            await localTable.add(localRecord);
            this.syncMetrics.totalOperations++;
            this.syncMetrics.successfulOperations++;
          } else {
            console.error(`Validation failed for new server record ${normalizedServerRecord.id} in ${tableName}`);
            this.syncMetrics.failedOperations++;
          }
        } else {
          // Check for conflicts using enhanced resolution
          const conflictResult = await this.resolveConflict(tableName, normalizedServerRecord.id, localRecord, normalizedServerRecord);

          if (conflictResult.resolved) {
            // Apply resolved data with normalized timestamps
            const updatedRecord = {
              ...this.normalizeServerRecordTimestamps(conflictResult.data),
              _syncStatus: 'synced' as const,
              _lastModified: nowISO(),
              _version: (localRecord._version || 0) + 1,
              _deleted: false
            };

            await localTable.update(normalizedServerRecord.id, updatedRecord);
            this.syncMetrics.totalOperations++;
            this.syncMetrics.successfulOperations++;
          } else {
            console.error(`Failed to resolve conflict for ${tableName}:${normalizedServerRecord.id}`);
            this.syncMetrics.failedOperations++;
          }
        }
      } catch (error) {
        console.error(`Error processing server record ${serverRecord.id} in ${tableName}:`, error);
        this.syncMetrics.failedOperations++;
      }
    }

    // Update last sync time
    await this.setLastSyncTime(tableName, nowISO());
  }

  /**
   * Enhanced cleanup with comprehensive resource management
   */
  destroy() {
    this.stopAutoSync();

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.eventListeners = [];
    this.syncCache.clear();
    this.compressionCache.clear();
    this.retryDelays.clear();

    // Remove event listeners
    window.removeEventListener('online', this.setupOnlineDetection);
    window.removeEventListener('offline', this.setupOnlineDetection);

    console.log('SyncManager destroyed and resources cleaned up');
  }
}

export const syncManager = new SyncManager();
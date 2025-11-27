import { AssetFile } from './types';
import { supabase, handleDatabaseError } from '../supabase';
import { db, LocalAsset } from '../db';
import { SyncManager } from '../sync/SyncManager';
import { userContextManager } from '../security/UserContextManager';
import {
  toISOString,
  localToSupabase,
  addSyncMetadata,
  addTimestamps,
  standardizeForService
} from '../utils/timestamp';

export class AssetService {
  private syncManager: SyncManager;
  private masterUserId: string | null = null;

  constructor(syncManager?: SyncManager) {
    this.syncManager = syncManager || new SyncManager();
    this.setupSyncEventListeners();
  }

  /**
   * Setup event listeners for sync events
   */
  private setupSyncEventListeners() {
    this.syncManager.addEventListener((event) => {
      if (event.table === 'assets') {
        switch (event.type) {
          case 'sync_complete':
            console.log('Asset sync completed');
            break;
          case 'sync_error':
            console.error('Asset sync error:', event.error);
            break;
          case 'conflict_detected':
            console.warn('Asset conflict detected:', event.message);
            break;
        }
      }
    });
  }

  /**
   * Set the current master user ID and configure sync
   */
  async initialize(masterUserId: string) {
    this.masterUserId = masterUserId;
    this.syncManager.setMasterUserId(masterUserId);

    // Start auto sync
    this.syncManager.startAutoSync();

    // Initial sync with error handling
    // Initial sync with error handling (non-blocking)
    this.syncManager.triggerSync().catch(error => {
      console.warn('Initial sync failed, will retry later:', error);
    });
  }


  /**
   * Get the current authenticated user
   */
  private async getCurrentUser() {
    const user = await userContextManager.getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    return user;
  }

  /**
   * Get master user ID (for multi-tenant support)
   */
  private async getMasterUserId(): Promise<string> {
    if (this.masterUserId) {
      return this.masterUserId;
    }

    const user = await this.getCurrentUser();

    // Get user's profile to find master_user_id
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('master_user_id')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      return user.id; // Fallback to current user ID
    }

    this.masterUserId = profile?.master_user_id || user.id;
    return this.masterUserId!;
  }

  /**
   * Transform local assets to match interface using standardized timestamps
   */
  private transformLocalAssets(localAssets: LocalAsset[]): AssetFile[] {
    return localAssets.map(asset => {
      // Use standardized timestamp transformation for assets
      const standardized = standardizeForService(asset, 'asset');

      // Handle both old and new property names for backwards compatibility
      const fileSize = asset.file_size || asset.size || 0;
      const fileType = asset.file_type || asset.type || '';
      const fileUrl = asset.file_url || asset.url || '';

      return {
        id: asset.id,
        name: asset.name,
        // Required properties with fallbacks
        file_name: asset.name, // Use name as file_name fallback
        file_size: fileSize,
        file_type: fileType,
        file_url: fileUrl,
        uploaded_by: asset.uploaded_by || '',
        category: asset.category,
        is_public: asset.is_public !== false,
        created_at: standardized.created_at || asset.created_at,
        updated_at: standardized.updated_at || asset.updated_at,
        // Legacy properties for backwards compatibility
        size: fileSize,
        type: fileType,
        url: fileUrl,
        uploadDate: asset.created_at,
        mime_type: asset.mime_type
      };
    });
  }

  /**
   * Get all assets for the current user's master account
   * Prioritizes local data, falls back to server if needed
   * Enforces data isolation using UserContextManager
   */
  async getAssets(): Promise<AssetFile[]> {
    try {
      // Enforce data isolation - check user context
      const hasPermission = await userContextManager.canPerformAction('read_assets', 'assets');
      if (!hasPermission) {
        throw new Error('Access denied: insufficient permissions to read assets');
      }

      const masterUserId = await this.getMasterUserId();

      // First, try to get from local database
      let localAssets = await db.assets
        .where('master_user_id')
        .equals(masterUserId)
        .and(asset => !asset._deleted)
        .toArray();

      // If we have local data, return it
      if (localAssets.length > 0) {
        return this.transformLocalAssets(localAssets);
      }

      // No local data, try to sync from server
      await this.syncManager.triggerSync();

      // Try local again after sync
      localAssets = await db.assets
        .where('master_user_id')
        .equals(masterUserId)
        .and(asset => !asset._deleted)
        .toArray();

      if (localAssets.length > 0) {
        return this.transformLocalAssets(localAssets);
      }

      // Still no data, return empty array (assets are uploaded, not fetched from server initially)
      return [];
    } catch (error) {
      console.error('Error fetching assets:', error);
      // Fallback to empty array if local operations fail
      return [];
    }
  }

  /**
   * Get a single asset by ID
   */
  async getAssetById(id: string): Promise<AssetFile | null> {
    try {
      const masterUserId = await this.getMasterUserId();

      // Try local first with proper master_user_id isolation
      const localAsset = await db.assets
        .where('master_user_id')
        .equals(masterUserId)
        .and(asset => !asset._deleted && asset.id === id)
        .first();

      if (localAsset) {
        const transformed = this.transformLocalAssets([localAsset]);
        return transformed[0] || null;
      }

      // For assets, we don't have a server table to fallback to
      // All assets are stored locally with their URLs
      return null;
    } catch (error) {
      console.error('Error fetching asset by ID:', error);
      return null;
    }
  }

  /**
   * Get assets by IDs
   */
  async getAssetsByIds(ids: string[]): Promise<AssetFile[]> {
    try {
      const masterUserId = await this.getMasterUserId();

      // Try local first
      const localAssets = await db.assets
        .where('master_user_id')
        .equals(masterUserId)
        .and(asset => !asset._deleted && ids.includes(asset.id))
        .toArray();

      if (localAssets.length > 0) {
        return this.transformLocalAssets(localAssets);
      }

      return [];
    } catch (error) {
      console.error('Error fetching assets by IDs:', error);
      return [];
    }
  }

  /**
   * Get assets by category
   */
  async getAssetsByCategory(category: AssetFile['category']): Promise<AssetFile[]> {
    try {
      const masterUserId = await this.getMasterUserId();

      // Try local first
      let localAssets = await db.assets
        .where('master_user_id')
        .equals(masterUserId)
        .and(asset => !asset._deleted && asset.category === category)
        .toArray();

      if (localAssets.length > 0) {
        return this.transformLocalAssets(localAssets);
      }

      return [];
    } catch (error) {
      console.error('Error fetching assets by category:', error);
      return [];
    }
  }

  /**
   * Upload a file and create asset record to server - online only (private method)
   */
  private async uploadAssetOnline(file: File, category: AssetFile['category']): Promise<AssetFile> {
    try {
      const user = await this.getCurrentUser();
      const masterUserId = await this.getMasterUserId();

      // First, upload the file to Supabase Storage
      const fileName = `${masterUserId}/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('assets')
        .upload(fileName, file);

      if (uploadError) {
        throw new Error(`Failed to upload file: ${uploadError.message}`);
      }

      // Get the public URL
      const { data: urlData } = supabase.storage
        .from('assets')
        .getPublicUrl(fileName);

      // Use standardized timestamp utilities
      const timestamps = addTimestamps({}, false);
      const syncMetadata = addSyncMetadata({}, false);
      const nowISOTime = toISOString(new Date());

      // Prepare local asset data
      const newLocalAsset: Omit<LocalAsset, 'id'> = {
        name: file.name,
        file_name: file.name, // Add required file_name property
        file_size: file.size,
        file_type: file.type,
        file_url: urlData.publicUrl,
        uploaded_by: user.id,
        category,
        master_user_id: masterUserId,
        is_public: true,
        mime_type: file.type,
        created_at: timestamps.created_at,
        updated_at: timestamps.updated_at,
        _syncStatus: syncMetadata._syncStatus,
        _lastModified: syncMetadata._lastModified,
        _version: syncMetadata._version,
        _deleted: false
      };

      // Add to local database first
      const assetId = crypto.randomUUID();
      const localAsset = {
        id: assetId,
        ...newLocalAsset
      };

      await db.assets.add(localAsset);

      // Transform for sync queue (convert Date objects to ISO strings)
      const syncData = localToSupabase(localAsset);
      await this.syncManager.addToSyncQueue('assets', 'create', assetId, syncData);

      // Return transformed asset
      return this.transformLocalAssets([localAsset])[0];
    } catch (error) {
      console.error('Error uploading asset:', error);
      throw new Error(handleDatabaseError(error));
    }
  }

  /**
   * Background sync assets without blocking the main operation
   */
  async backgroundSyncAssets(): Promise<void> {
    try {
      // Don't await this to avoid blocking the main operation
      this.syncManager.triggerSync().catch(error => {
        console.warn('Background sync failed:', error);
      });
    } catch (error) {
      console.warn('Failed to trigger background sync:', error);
    }
  }

  /**
   * Background sync specifically for pending asset uploads
   */
  async backgroundSyncPendingAssets(): Promise<void> {
    try {
      // Get all pending assets for the current user
      const masterUserId = await this.getMasterUserId();
      const pendingAssets = await db.assets
        .where('master_user_id')
        .equals(masterUserId)
        .and(asset => asset._syncStatus === 'pending')
        .toArray();

      if (pendingAssets.length === 0) {
        return; // Nothing to sync
      }

      // Check if we're online before attempting sync
      const isOnline = this.syncManager.getIsOnline();
      if (!isOnline) {
        console.log('Offline, skipping pending asset sync');
        return;
      }

      // Process each pending asset
      for (const asset of pendingAssets) {
        try {
          // Find the cached blob for this asset if available
          const cachedBlob = await this.getCachedAssetFile(asset.id);

          if (cachedBlob) {
            // Attempt to upload the asset
            await this.uploadAssetOnline(cachedBlob as any, asset.category);

            // Update the sync status after successful upload
            await db.assets.update(asset.id, {
              _syncStatus: 'synced',
              _lastModified: toISOString(new Date())
            });
          }
        } catch (error) {
          console.error(`Failed to sync pending asset ${asset.id}:`, error);
          // Keep the asset as pending for retry
          await db.assets.update(asset.id, {
            _syncStatus: 'pending',
            _lastModified: toISOString(new Date())
          });
        }
      }
    } catch (error) {
      console.error('Error during background sync of pending assets:', error);
    }
  }

  /**
   * Queue asset upload for offline-first processing
   */
  async queueUpload(file: File, metadata: { category: AssetFile['category'] }): Promise<AssetFile> {
    try {
      const user = await this.getCurrentUser();
      const masterUserId = await this.getMasterUserId();

      // Check online status
      const isOnline = this.syncManager.getIsOnline();

      // First, generate asset ID for reference
      const assetId = crypto.randomUUID();

      // First, store the file blob in asset_blobs table for caching
      await this.cacheAssetFile(assetId, file);

      // Prepare local asset data with standardized timestamps
      const nowISOTime = toISOString(new Date());
      const syncMetadata = addSyncMetadata({}, false);

      const newLocalAsset: Omit<LocalAsset, 'id'> = {
        name: file.name,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        file_url: '', // Will be filled after online upload
        uploaded_by: user.id,
        category: metadata.category,
        master_user_id: masterUserId,
        is_public: true,
        mime_type: file.type,
        created_at: nowISOTime,
        updated_at: nowISOTime,
        _syncStatus: 'pending',
        _lastModified: nowISOTime,
        _version: 1,
        _deleted: false
      };

      const localAsset = {
        id: assetId,
        ...newLocalAsset
      };

      // Add to local database with pending status
      await db.assets.add(localAsset);

      if (isOnline) {
        // If online, attempt immediate upload
        const uploadedAsset = await this.uploadAssetOnline(file, metadata.category);
        return uploadedAsset;
      } else {
        // If offline, queue for background sync
        await this.syncManager.addToSyncQueue('assets', 'create', assetId, localToSupabase(localAsset));

        // Return the local asset
        return this.transformLocalAssets([localAsset])[0];
      }
    } catch (error) {
      console.error('Error queueing asset upload:', error);
      throw new Error(handleDatabaseError(error));
    }
  }

  /**
   * Delete an asset - soft delete locally with sync
   */
  async deleteAsset(id: string): Promise<boolean> {
    try {
      const masterUserId = await this.getMasterUserId();

      // Check if asset exists locally with proper user isolation
      const existingAsset = await db.assets
        .where('master_user_id')
        .equals(masterUserId)
        .and(asset => !asset._deleted && asset.id === id)
        .first();

      if (!existingAsset) {
        // Try server-side deletion if not found locally
        await this.deleteAssetFromServer(id);
        return true;
      }

      // Use standardized sync metadata for soft delete
      const syncMetadata = addSyncMetadata(existingAsset, true);

      // Soft delete locally
      await db.assets.update(id, {
        _syncStatus: syncMetadata._syncStatus,
        _lastModified: syncMetadata._lastModified,
        _version: syncMetadata._version,
        _deleted: true
      });

      // Transform for sync queue (convert Date objects to ISO strings)
      const syncData = localToSupabase(existingAsset);
      await this.syncManager.addToSyncQueue('assets', 'delete', id, syncData);

      // Also delete from Supabase Storage
      if (existingAsset.url) {
        try {
          const fileName = this.extractFileNameFromUrl(existingAsset.url);
          if (fileName) {
            await supabase.storage
              .from('assets')
              .remove([fileName]);
          }
        } catch (storageError) {
          console.warn('Failed to delete file from storage:', storageError);
        }
      }

      return true;
    } catch (error) {
      console.error('Error deleting asset:', error);
      throw new Error(handleDatabaseError(error));
    }
  }

  /**
   * Delete asset from server storage (fallback)
   */
  private async deleteAssetFromServer(id: string): Promise<void> {
    // For assets, we don't have a database table to delete from
    // We just need to delete from storage if we have the URL
    // This is mainly for cleanup in case local data is corrupted
    const masterUserId = await this.getMasterUserId();
    const asset = await db.assets
      .where('master_user_id')
      .equals(masterUserId)
      .and(item => item.id === id)
      .first();
    if (asset?.url) {
      try {
        const fileName = this.extractFileNameFromUrl(asset.url);
        if (fileName) {
          await supabase.storage
            .from('assets')
            .remove([fileName]);
        }
      } catch (storageError) {
        console.warn('Failed to delete file from storage:', storageError);
      }
    }
  }

  /**
   * Extract file name from Supabase storage URL
   */
  private extractFileNameFromUrl(url: string): string | null {
    try {
      // URL format: https://[project].supabase.co/storage/v1/object/public/assets/[masterUserId]/[timestamp]_[filename]
      const parts = url.split('/');
      const fileNamePart = parts[parts.length - 1];
      return fileNamePart ? `${parts[parts.length - 2]}/${fileNamePart}` : null;
    } catch {
      return null;
    }
  }

  /**
   * Get assets suitable for WhatsApp messaging
   */
  async getWhatsAppCompatibleAssets(): Promise<AssetFile[]> {
    try {
      const assets = await this.getAssets();
      return assets.filter(asset => {
        const type = (asset.type || '').toLowerCase();
        const category = asset.category;
        // WhatsApp supports: images (jpg, png), documents (pdf), videos (mp4)
        return (category === 'image' && (type.includes('image'))) ||
          (category === 'document' && type.includes('pdf')) ||
          (category === 'video' && type.includes('video'));
      });
    } catch (error) {
      console.error('Error fetching WhatsApp compatible assets:', error);
      return [];
    }
  }

  /**
   * Validate if asset can be sent via WhatsApp
   */
  canSendViaWhatsApp(asset: AssetFile): boolean {
    const whatsappLimits = {
      image: 16 * 1024 * 1024, // 16MB
      video: 16 * 1024 * 1024, // 16MB
      document: 100 * 1024 * 1024 // 100MB
    };

    const type = (asset.type || '').toLowerCase();
    const category = asset.category;
    const size = asset.size || 0;

    if (category === 'image' && type.includes('image')) {
      return size <= whatsappLimits.image;
    }
    if (category === 'video' && type.includes('video')) {
      return size <= whatsappLimits.video;
    }
    if (category === 'document' && type.includes('pdf')) {
      return size <= whatsappLimits.document;
    }

    return false;
  }

  /**
   * Get asset statistics
   */
  async getAssetStats() {
    try {
      const assets = await this.getAssets();

      const totalSize = assets.reduce((sum, asset) => sum + (asset.size || 0), 0);
      const categoryStats = assets.reduce((stats, asset) => {
        stats[asset.category] = (stats[asset.category] || 0) + 1;
        return stats;
      }, {} as Record<string, number>);

      const largestAsset = assets.reduce((largest, asset) =>
        (asset.size || 0) > (largest.size || 0) ? asset : largest,
        assets[0]
      );

      return {
        total: assets.length,
        totalSize,
        categoryStats,
        largestAsset: largestAsset || null,
        averageSize: assets.length > 0 ? Math.round(totalSize / assets.length) : 0
      };
    } catch (error) {
      console.error('Error fetching asset stats:', error);
      return {
        total: 0,
        totalSize: 0,
        categoryStats: {},
        largestAsset: null,
        averageSize: 0
      };
    }
  }

  /**
   * Format asset info for display
   */
  getAssetDisplayInfo(asset: AssetFile): { icon: string; label: string; description: string } {
    const category = asset.category;

    switch (category) {
      case 'image':
        return {
          icon: '🖼️',
          label: 'Image',
          description: `${asset.name} (${this.formatFileSize(asset.size || 0)})`
        };
      case 'video':
        return {
          icon: '🎬',
          label: 'Video',
          description: `${asset.name} (${this.formatFileSize(asset.size || 0)})`
        };
      case 'document':
        return {
          icon: '📄',
          label: 'Document',
          description: `${asset.name} (${this.formatFileSize(asset.size || 0)})`
        };
      case 'audio':
        return {
          icon: '🎵',
          label: 'Audio',
          description: `${asset.name} (${this.formatFileSize(asset.size || 0)})`
        };
      default:
        return {
          icon: '📎',
          label: 'File',
          description: `${asset.name} (${this.formatFileSize(asset.size || 0)})`
        };
    }
  }

  /**
   * Format file size
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get asset categories for filtering
   */
  getAssetCategories(): { value: AssetFile['category']; label: string; icon: string }[] {
    return [
      { value: 'image', label: 'Images', icon: '🖼️' },
      { value: 'video', label: 'Videos', icon: '🎬' },
      { value: 'audio', label: 'Audio', icon: '🎵' },
      { value: 'document', label: 'Documents', icon: '📄' },
      { value: 'other', label: 'Other', icon: '📎' }
    ];
  }

  /**
   * Determine asset category from file type
   */
  getCategoryFromFileType(file: File): AssetFile['category'] {
    const type = file.type.toLowerCase();

    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('video/')) return 'video';
    if (type.startsWith('audio/')) return 'audio';
    if (type.includes('pdf') || type.includes('document') || type.includes('text/')) return 'document';

    return 'other';
  }

  /**
   * Force sync with server
   */
  async forceSync(): Promise<void> {
    await this.syncManager.triggerSync();
  }

  /**
   * Get sync status for assets
   */
  async getSyncStatus() {
    const localAssets = await db.assets
      .where('master_user_id')
      .equals(await this.getMasterUserId())
      .and(asset => !asset._deleted)
      .toArray();

    const pending = localAssets.filter(a => a._syncStatus === 'pending').length;
    const synced = localAssets.filter(a => a._syncStatus === 'synced').length;
    const conflicts = localAssets.filter(a => a._syncStatus === 'conflict').length;

    return {
      total: localAssets.length,
      pending,
      synced,
      conflicts,
      syncManagerStatus: this.syncManager.getStatus()
    };
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.syncManager.destroy();
  }

  /**
   * Cache an asset file in IndexedDB
   * @param assetId - The ID of the asset
   * @param blob - The blob data to cache
   */
  async cacheAssetFile(assetId: string, blob: Blob): Promise<void> {
    try {
      // Get the asset to validate existence and get metadata
      const masterUserId = await this.getMasterUserId();
      const asset = await db.assets
        .where('master_user_id')
        .equals(masterUserId)
        .and(item => item.id === assetId)
        .first();

      if (!asset) {
        throw new Error(`Asset with ID ${assetId} not found`);
      }

      // Check if we're approaching storage limits (16MB for WhatsApp compatibility)
      const maxAssetSize = 16 * 1024 * 1024; // 16MB
      if (blob.size > maxAssetSize) {
        throw new Error(`Asset exceeds maximum size of ${maxAssetSize} bytes`);
      }

      // Check total storage quota
      const currentUsage = await this.getCurrentStorageUsage();
      const maxCacheSize = 500 * 1024 * 1024; // 500MB as specified in the config
      if (currentUsage + blob.size > maxCacheSize) {
        // Evict oldest assets until there's enough space
        await this.evictOldestAssets(blob.size);
      }

      // Store the blob in the asset_blobs table
      const cacheEntry = {
        asset_id: assetId,
        blob: blob,
        mime_type: blob.type,
        size: blob.size,
        cached_at: toISOString(new Date()),
        last_accessed: toISOString(new Date()),
        _version: 1
      };

      // Use put to update if exists or add if new
      await db.asset_blobs.put(cacheEntry);
      console.log(`Asset ${assetId} cached successfully, size: ${blob.size} bytes`);
    } catch (error) {
      console.error(`Error caching asset file ${assetId}:`, error);
      throw new Error(`Failed to cache asset: ${handleDatabaseError(error)}`);
    }
  }

  /**
   * Get a cached asset file from IndexedDB
   * @param assetId - The ID of the asset to retrieve
   * @returns The cached blob or null if not found
   */
  async getCachedAssetFile(assetId: string): Promise<Blob | null> {
    try {
      const cacheEntry = await db.asset_blobs.get(assetId);
      if (!cacheEntry) {
        return null;
      }

      // Update last accessed timestamp
      await db.asset_blobs.update(assetId, {
        last_accessed: toISOString(new Date())
      });

      console.log(`Asset ${assetId} retrieved from cache`);
      return cacheEntry.blob;
    } catch (error) {
      console.error(`Error retrieving cached asset file ${assetId}:`, error);
      return null;
    }
  }

  /**
   * Get an asset with cache fallback
   * @param assetId - The ID of the asset to retrieve
   * @returns The asset blob (from cache or fetched from server)
   */
  async getAssetWithCache(assetId: string): Promise<Blob> {
    try {
      // First, try to get from cache
      let cachedBlob = await this.getCachedAssetFile(assetId);
      if (cachedBlob) {
        return cachedBlob;
      }

      // Cache miss - fetch from server
      const masterUserId = await this.getMasterUserId();
      const asset = await db.assets
        .where('master_user_id')
        .equals(masterUserId)
        .and(item => item.id === assetId)
        .first();
      if (!asset) {
        throw new Error(`Asset with ID ${assetId} not found`);
      }

      // Download from the asset URL
      const response = await fetch(asset.file_url);
      if (!response.ok) {
        throw new Error(`Failed to fetch asset from ${asset.file_url}: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();

      // Cache the downloaded asset for future use
      try {
        await this.cacheAssetFile(assetId, blob);
      } catch (cacheError) {
        // Non-critical error - continue with the blob even if caching fails
        console.warn(`Failed to cache asset ${assetId}:`, cacheError);
      }

      return blob;
    } catch (error) {
      console.error(`Error getting asset with cache ${assetId}:`, error);
      throw new Error(`Failed to get asset: ${handleDatabaseError(error)}`);
    }
  }

  /**
   * Clear asset cache
   * @param olderThan - Optional date to clear only assets cached before this date
   */
  async clearAssetCache(olderThan?: Date): Promise<void> {
    try {
      if (olderThan) {
        // Clear assets cached before the specified date
        await db.asset_blobs
          .where('cached_at')
          .below(toISOString(olderThan))
          .delete();
      } else {
        // Clear all cached assets
        await db.asset_blobs.clear();
      }

      console.log('Asset cache cleared successfully');
    } catch (error) {
      console.error('Error clearing asset cache:', error);
      throw new Error(`Failed to clear asset cache: ${handleDatabaseError(error)}`);
    }
  }

  /**
   * Get current storage usage for asset cache
   */
  async getCurrentStorageUsage(): Promise<number> {
    try {
      const allCachedAssets = await db.asset_blobs.toArray();
      return allCachedAssets.reduce((total, asset) => total + asset.size, 0);
    } catch (error) {
      console.error('Error getting current storage usage:', error);
      return 0;
    }
  }

  /**
   * Evict oldest cached assets to free up space
   * @param requiredSize - The amount of space needed in bytes
   */
  async evictOldestAssets(requiredSize: number): Promise<void> {
    try {
      // Get currently cached assets
      const cachedAssets = await db.asset_blobs.orderBy('last_accessed').toArray();

      let freedSize = 0;
      let index = 0;

      while (freedSize < requiredSize && index < cachedAssets.length) {
        const asset = cachedAssets[index];
        await db.asset_blobs.delete(asset.asset_id);
        freedSize += asset.size;
        index++;
      }

      console.log(`Evicted ${index} cached assets to free up ${freedSize} bytes`);
    } catch (error) {
      console.error('Error evicting oldest assets:', error);
      throw new Error(`Failed to evict assets: ${handleDatabaseError(error)}`);
    }
  }

  /**
   * Pre-fetch assets in background
   * @param assetIds - Array of asset IDs to prefetch
   */
  async prefetchAssets(assetIds: string[]): Promise<void> {
    try {
      const results = await Promise.allSettled(
        assetIds.map(async (assetId) => {
          // Check if already cached
          const isCached = await this.getCachedAssetFile(assetId);
          if (isCached) {
            console.log(`Asset ${assetId} already cached, skipping prefetch`);
            return;
          }

          // Fetch and cache the asset
          const masterUserId = await this.getMasterUserId();
          const asset = await db.assets
            .where('master_user_id')
            .equals(masterUserId)
            .and(item => item.id === assetId)
            .first();
          if (!asset) {
            throw new Error(`Asset with ID ${assetId} not found for prefetch`);
          }

          const response = await fetch(asset.file_url);
          if (!response.ok) {
            throw new Error(`Failed to prefetch asset from ${asset.file_url}`);
          }

          const blob = await response.blob();
          await this.cacheAssetFile(assetId, blob);
        })
      );

      // Count successful and failed prefetches
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      console.log(`Prefetch completed: ${successful} successful, ${failed} failed`);
    } catch (error) {
      console.error('Error pre-fetching assets:', error);
      throw new Error(`Failed to prefetch assets: ${handleDatabaseError(error)}`);
    }
  }
}

// Export both the class and create a singleton instance
export const assetService = new AssetService();
export { AssetService as AssetServiceClass };
export type { AssetFile };
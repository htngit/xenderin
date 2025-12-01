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
  private initialSyncComplete: boolean = false;
  private initialSyncPromise: Promise<void> | null = null;

  constructor(syncManager?: SyncManager) {
    this.syncManager = syncManager || new SyncManager();
  }

  /**
   * Set the current master user ID and configure sync
   */
  async initialize(masterUserId: string) {
    this.masterUserId = masterUserId;
    this.syncManager.setMasterUserId(masterUserId);

    // Start auto sync
    this.syncManager.startAutoSync();
  }

  /**
   * Check if initial sync is complete
   */
  isInitialSyncComplete(): boolean {
    return this.initialSyncComplete;
  }

  /**
   * Wait for initial sync to complete (with timeout)
   */
  async waitForInitialSync(timeoutMs: number = 5000): Promise<boolean> {
    if (this.initialSyncComplete) {
      return true;
    }

    if (!this.initialSyncPromise) {
      return false;
    }

    try {
      await Promise.race([
        this.initialSyncPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Sync timeout')), timeoutMs))
      ]);
      return true;
    } catch (error) {
      console.warn('Initial sync timeout or failed:', error);
      this.initialSyncComplete = true; // Mark as complete to unblock UI
      return false;
    }
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
        file_name: asset.file_name || asset.name, // Use file_name if available, otherwise fallback to name
        file_size: fileSize,
        file_type: fileType,
        file_url: fileUrl,
        uploaded_by: asset.uploaded_by || '',
        master_user_id: asset.master_user_id || '', // Add the missing master_user_id property
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
    console.log('AssetService: getAssets() - Starting asset fetch operation');
    console.log('AssetService: Checking initial sync completion status');
    console.log('AssetService: Initial sync complete?', this.initialSyncComplete);

    try {
      // Enforce data isolation - check user context
      const hasPermission = await userContextManager.canPerformAction('read_assets', 'assets');
      if (!hasPermission) {
        console.error('AssetService: Access denied - insufficient permissions to read assets');
        throw new Error('Access denied: insufficient permissions to read assets');
      }

      const masterUserId = await this.getMasterUserId();
      console.log('AssetService: Fetching assets for master user ID:', masterUserId);

      // First, try to get from local database
      let localAssets = await db.assets
        .where('master_user_id')
        .equals(masterUserId)
        .and(asset => !asset._deleted)
        .toArray();

      console.log('AssetService: Found', localAssets.length, 'local assets before sync');

      // If we have local data, return it
      if (localAssets.length > 0) {
        console.log('AssetService: Returning', localAssets.length, 'local assets from database');
        return this.transformLocalAssets(localAssets);
      }

      console.log('AssetService: No local assets found, triggering sync to fetch from server...');
      // No local data, try to sync from server
      await this.syncManager.triggerSync();
      console.log('AssetService: Sync completed, fetching assets from local DB again...');

      // Try local again after sync
      localAssets = await db.assets
        .where('master_user_id')
        .equals(masterUserId)
        .and(asset => !asset._deleted)
        .toArray();

      console.log('AssetService: Found', localAssets.length, 'local assets after sync');

      if (localAssets.length > 0) {
        console.log('AssetService: Returning', localAssets.length, 'local assets from database after sync');
        return this.transformLocalAssets(localAssets);
      }

      // Still no data, return empty array (assets are uploaded, not fetched from server initially)
      console.log('AssetService: No assets found from server, returning empty array');
      return [];
    } catch (error) {
      console.error('AssetService: Error fetching assets:', error);
      // Fallback to empty array if local operations fail
      return [];
    }
  }

  /**
   * Get a single asset by ID
   */
  async getAssetById(id: string): Promise<AssetFile | null> {
    console.log('AssetService: getAssetById() - Fetching asset with ID:', id);
    try {
      const masterUserId = await this.getMasterUserId();
      console.log('AssetService: Fetching asset for master user ID:', masterUserId);

      // Try local first with proper master_user_id isolation
      const localAsset = await db.assets
        .where('master_user_id')
        .equals(masterUserId)
        .and(asset => !asset._deleted && asset.id === id)
        .first();

      if (localAsset) {
        console.log('AssetService: Found asset in local database:', localAsset.name, 'with URL:', localAsset.file_url);
        const transformed = this.transformLocalAssets([localAsset]);
        return transformed[0] || null;
      }

      console.log('AssetService: Asset not found in local database');
      // For assets, we don't have a server table to fallback to
      // All assets are stored locally with their URLs
      return null;
    } catch (error) {
      console.error('AssetService: Error fetching asset by ID:', error);
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
      const { error: uploadError } = await supabase.storage
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
      toISOString(new Date());

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
    console.log('AssetService: queueUpload() - Starting asset upload process for file:', file.name);
    console.log('AssetService: File details - type:', file.type, 'size:', file.size, 'category:', metadata.category);

    try {
      const user = await this.getCurrentUser();
      const masterUserId = await this.getMasterUserId();
      console.log('AssetService: Current user:', user.id, 'Master user:', masterUserId);

      // Check online status
      const isOnline = this.syncManager.getIsOnline();
      console.log('AssetService: Online status:', isOnline);

      // First, generate asset ID for reference
      const assetId = crypto.randomUUID();
      console.log('AssetService: Generated asset ID:', assetId);

      // Prepare local asset data with standardized timestamps
      const nowISOTime = toISOString(new Date());

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

      console.log('AssetService: Adding asset to local database...');
      // Add to local database with pending status FIRST
      await db.assets.add(localAsset);
      console.log('AssetService: Asset added to local database');

      console.log('AssetService: Caching asset file in blob storage...');
      // THEN store the file blob in asset_blobs table for caching
      // (cacheAssetFile validates asset exists in DB)
      await this.cacheAssetFile(assetId, file);
      console.log('AssetService: Asset file cached successfully');

      if (isOnline) {
        console.log('AssetService: Device is online, attempting direct upload to Supabase Storage...');
        // If online, upload file to storage and update the asset
        try {
          // Upload the file to Supabase Storage
          const fileName = `${masterUserId}/${Date.now()}_${file.name}`;
          console.log('AssetService: Uploading file to Supabase Storage with filename:', fileName);

          const { error: uploadError } = await supabase.storage
            .from('assets')
            .upload(fileName, file);

          if (uploadError) {
            console.error('AssetService: Upload to Supabase Storage failed:', uploadError.message);
            throw new Error(`Failed to upload file: ${uploadError.message}`);
          }

          console.log('AssetService: File uploaded successfully to Supabase Storage');

          // Get the public URL
          const { data: urlData } = supabase.storage
            .from('assets')
            .getPublicUrl(fileName);

          console.log('AssetService: Generated public URL:', urlData.publicUrl);

          // Update the local asset with the file URL
          const updatedAsset = {
            ...localAsset,
            file_url: urlData.publicUrl,
            _syncStatus: 'pending' as const,
            _lastModified: toISOString(new Date())
          };

          await db.assets.update(assetId, {
            file_url: urlData.publicUrl,
            _syncStatus: 'pending',
            _lastModified: toISOString(new Date())
          });
          console.log('AssetService: Local asset updated with URL');

          // Add to sync queue with complete data including master_user_id
          const syncData = localToSupabase(updatedAsset);
          console.log('AssetService: Queueing asset for sync:', {
            id: assetId,
            master_user_id: syncData.master_user_id,
            has_master_user_id: !!syncData.master_user_id
          });
          await this.syncManager.addToSyncQueue('assets', 'create', assetId, syncData);
          console.log('AssetService: Asset queued for sync');

          // Return the updated asset
          const result = this.transformLocalAssets([updatedAsset])[0];
          console.log('AssetService: Upload complete, returning asset:', result.name);
          return result;
        } catch (uploadError) {
          console.error('AssetService: Failed to upload to storage, will retry later:', uploadError);
          // Keep asset as pending for background sync
          await this.syncManager.addToSyncQueue('assets', 'create', assetId, localToSupabase(localAsset));
          return this.transformLocalAssets([localAsset])[0];
        }
      } else {
        console.log('AssetService: Device is offline, queueing for background sync');
        // If offline, queue for background sync
        await this.syncManager.addToSyncQueue('assets', 'create', assetId, localToSupabase(localAsset));
        console.log('AssetService: Asset queued for background sync');

        // Return the local asset
        const result = this.transformLocalAssets([localAsset])[0];
        console.log('AssetService: Upload queued, returning asset:', result.name);
        return result;
      }
    } catch (error) {
      console.error('AssetService: Error queueing asset upload:', error);
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
        console.log(`AssetService: Asset ${id} not found locally, attempted server-side deletion`);
        return true;
      }

      // Log asset deletion to console with metadata
      console.log(`AssetService: Asset deleted locally with metadata - ID: ${id}, Name: ${existingAsset.name}, Type: ${existingAsset.file_type}, Size: ${existingAsset.file_size} bytes, Category: ${existingAsset.category}. Waiting to sync delete on cloud.`);

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
    console.log('AssetService: cacheAssetFile() - Attempting to cache asset with ID:', assetId, 'size:', blob.size, 'bytes');
    try {
      // Get the asset to validate existence and get metadata
      const masterUserId = await this.getMasterUserId();
      console.log('AssetService: Validating asset exists for user:', masterUserId);
      const asset = await db.assets
        .where('master_user_id')
        .equals(masterUserId)
        .and(item => item.id === assetId)
        .first();

      if (!asset) {
        console.error(`AssetService: Asset with ID ${assetId} not found, cannot cache`);
        throw new Error(`Asset with ID ${assetId} not found`);
      }

      console.log('AssetService: Asset validation passed, asset found:', asset.name);

      // Check if we're approaching storage limits (16MB for WhatsApp compatibility)
      const maxAssetSize = 16 * 1024 * 1024; // 16MB
      if (blob.size > maxAssetSize) {
        console.error(`AssetService: Asset exceeds maximum size of ${maxAssetSize} bytes`);
        throw new Error(`Asset exceeds maximum size of ${maxAssetSize} bytes`);
      }

      // Check total storage quota
      const currentUsage = await this.getCurrentStorageUsage();
      const maxCacheSize = 500 * 1024 * 1024; // 500MB as specified in the config
      console.log(`AssetService: Current cache usage: ${currentUsage} bytes, requested: ${blob.size} bytes, max: ${maxCacheSize} bytes`);

      if (currentUsage + blob.size > maxCacheSize) {
        console.log('AssetService: Cache size limit approaching, attempting to evict oldest assets...');
        // Evict oldest assets until there's enough space
        await this.evictOldestAssets(blob.size);
        console.log('AssetService: Asset eviction completed');
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
      console.log(`AssetService: Asset ${assetId} cached successfully, size: ${blob.size} bytes`);
    } catch (error) {
      console.error(`AssetService: Error caching asset file ${assetId}:`, error);
      throw new Error(`Failed to cache asset: ${handleDatabaseError(error)}`);
    }
  }


  /**
   * Get a cached asset file from IndexedDB
   * @param assetId - The ID of the asset to retrieve
   * @returns The cached blob or null if not found
   */
  async getCachedAssetFile(assetId: string): Promise<Blob | null> {
    console.log('AssetService: getCachedAssetFile() - Attempting to retrieve cached asset with ID:', assetId);
    try {
      const cacheEntry = await db.asset_blobs.get(assetId);
      if (!cacheEntry) {
        console.log(`AssetService: Asset ${assetId} not found in cache`);
        return null;
      }

      // Update last accessed timestamp
      await db.asset_blobs.update(assetId, {
        last_accessed: toISOString(new Date())
      });

      console.log(`AssetService: Asset ${assetId} retrieved from cache, size: ${cacheEntry.size} bytes, type: ${cacheEntry.mime_type}`);
      return cacheEntry.blob;
    } catch (error) {
      console.error(`AssetService: Error retrieving cached asset file ${assetId}:`, error);
      return null;
    }
  }

  /**
   * Get an asset with cache fallback
   * @param assetId - The ID of the asset to retrieve
   * @returns The asset blob (from cache or fetched from server)
   */
  async getAssetWithCache(assetId: string): Promise<Blob> {
    console.log('AssetService: getAssetWithCache() - Attempting to retrieve asset with ID:', assetId);

    try {
      // First, try to get from cache
      let cachedBlob = await this.getCachedAssetFile(assetId);
      if (cachedBlob) {
        console.log('AssetService: Asset found in cache, returning cached version');
        return cachedBlob;
      }

      console.log('AssetService: Asset not found in cache, looking for local asset record...');
      // Cache miss - fetch from server
      const masterUserId = await this.getMasterUserId();
      const asset = await db.assets
        .where('master_user_id')
        .equals(masterUserId)
        .and(item => item.id === assetId)
        .first();
      if (!asset) {
        console.error(`AssetService: Asset with ID ${assetId} not found in local database`);
        throw new Error(`Asset with ID ${assetId} not found`);
      }

      console.log('AssetService: Found asset record, attempting to download from URL:', asset.file_url);

      // Download from the asset URL
      console.log('AssetService: Fetching asset from server URL:', asset.file_url);
      const response = await fetch(asset.file_url);
      if (!response.ok) {
        console.error(`AssetService: Failed to fetch asset from ${asset.file_url}: ${response.status} ${response.statusText}`);
        throw new Error(`Failed to fetch asset from ${asset.file_url}: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      console.log('AssetService: Asset downloaded successfully, size:', blob.size, 'bytes, type:', blob.type);

      // Cache the downloaded asset for future use
      try {
        await this.cacheAssetFile(assetId, blob);
        console.log('AssetService: Asset cached successfully for future use');
      } catch (cacheError) {
        // Non-critical error - continue with the blob even if caching fails
        console.warn(`AssetService: Failed to cache asset ${assetId}:`, cacheError);
      }

      console.log('AssetService: Successfully retrieved and cached asset');
      return blob;
    } catch (error) {
      console.error(`AssetService: Error getting asset with cache ${assetId}:`, error);
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
   * Sync and cache all assets for the current user
   * Matches local metadata with cached blobs and downloads missing content
   * Returns stats for UI feedback
   */
  async syncAssetsFromSupabase(onProgress?: (progress: number) => void): Promise<{ syncedCount: number; skippedCount: number; errorCount: number }> {
    console.log('AssetService: syncAssetsFromSupabase() - Starting full asset content sync');
    try {
      const masterUserId = await this.getMasterUserId();

      // Get all asset IDs from local DB (metadata is already synced)
      const allAssets = await db.assets
        .where('master_user_id')
        .equals(masterUserId)
        .and(asset => !asset._deleted)
        .toArray();

      if (allAssets.length === 0) {
        console.log('AssetService: No assets found in local DB. Checking Supabase directly...');

        // Fallback: Check Supabase directly in case sync failed or hasn't run yet
        const { data: serverAssets, error } = await supabase
          .from('assets')
          .select('*')
          .eq('master_user_id', masterUserId);

        if (error) {
          console.error('AssetService: Error checking Supabase for assets:', error);
          if (onProgress) onProgress(100);
          return { syncedCount: 0, skippedCount: 0, errorCount: 0 };
        }

        if (!serverAssets || serverAssets.length === 0) {
          console.log('AssetService: No assets found on Supabase either.');
          if (onProgress) onProgress(100);
          return { syncedCount: 0, skippedCount: 0, errorCount: 0 };
        }

        console.log(`AssetService: Found ${serverAssets.length} assets on Supabase that were missing locally. Syncing metadata...`);

        // Insert missing metadata into local DB
        await db.assets.bulkPut(serverAssets.map(asset => ({
          ...asset,
          _syncStatus: 'synced',
          _lastModified: new Date().toISOString(),
          _version: 1,
          _deleted: false
        })));

        // Update allAssets array to proceed with download
        allAssets.push(...serverAssets as any[]);
      }

      const assetIds = allAssets.map(a => a.id);
      console.log(`AssetService: Found ${assetIds.length} assets to check/download`);

      // Use prefetchAssets with progress tracking
      const stats = await this.prefetchAssets(assetIds, onProgress);

      console.log('AssetService: Full asset content sync completed', stats);

      return {
        syncedCount: stats.success,
        skippedCount: stats.skipped,
        errorCount: stats.failed
      };
    } catch (error) {
      console.error('AssetService: Error during full asset content sync:', error);
      // Return empty stats on error to avoid breaking UI
      return { syncedCount: 0, skippedCount: 0, errorCount: 0 };
    }
  }

  /**
   * Pre-fetch assets in background with concurrency limit
   * @param assetIds - Array of asset IDs to prefetch
   * @param onProgress - Optional callback for progress updates (0-100)
   * @returns Stats about the prefetch operation
   */
  async prefetchAssets(assetIds: string[], onProgress?: (progress: number) => void): Promise<{ success: number; skipped: number; failed: number }> {
    console.log('AssetService: prefetchAssets() - Starting prefetch for', assetIds.length, 'assets');

    const CONCURRENCY = 3;
    const total = assetIds.length;
    let completed = 0;

    // Stats tracking
    let success = 0;
    let skipped = 0;
    let failed = 0;

    const processAsset = async (assetId: string) => {
      try {
        // Check if already cached
        const isCached = await this.getCachedAssetFile(assetId);
        if (isCached) {
          console.log(`AssetService: Asset ${assetId} already cached, skipping download`);
          skipped++;
          return;
        }

        // Fetch and cache
        const masterUserId = await this.getMasterUserId();
        const asset = await db.assets
          .where('master_user_id')
          .equals(masterUserId)
          .and(item => item.id === assetId)
          .first();

        if (!asset) {
          console.warn(`AssetService: Asset with ID ${assetId} not found for prefetch`);
          failed++; // Count as failed if metadata missing
          return;
        }

        if (!asset.file_url) {
          console.log(`AssetService: Asset ${assetId} has no URL, skipping`);
          skipped++;
          return;
        }

        console.log(`AssetService: Downloading asset ${assetId} from URL:`, asset.file_url);
        const response = await fetch(asset.file_url);
        if (!response.ok) {
          throw new Error(`Failed to prefetch asset from ${asset.file_url}: ${response.status}`);
        }

        const blob = await response.blob();
        console.log(`AssetService: Downloaded asset ${assetId}, size:`, blob.size, 'bytes');
        await this.cacheAssetFile(assetId, blob);
        console.log(`AssetService: Asset ${assetId} successfully cached`);
        success++;

      } catch (error) {
        console.error(`AssetService: Error pre-fetching asset ${assetId}:`, error);
        failed++;
      } finally {
        completed++;
        if (onProgress) {
          onProgress(Math.round((completed / total) * 100));
        }
      }
    };

    // Execute with concurrency limit
    const executing = new Set<Promise<void>>();
    const results: Promise<void>[] = [];

    for (const id of assetIds) {
      const p = processAsset(id).then(() => {
        executing.delete(p);
      });
      results.push(p);
      executing.add(p);

      if (executing.size >= CONCURRENCY) {
        await Promise.race(executing);
      }
    }

    await Promise.all(results);

    console.log(`AssetService: Prefetch completed. Processed ${completed}/${total} assets. Success: ${success}, Skipped: ${skipped}, Failed: ${failed}`);
    return { success, skipped, failed };
  }
}

// Export both the class and create a singleton instance
export const assetService = new AssetService();
export { AssetService as AssetServiceClass };
export type { AssetFile };
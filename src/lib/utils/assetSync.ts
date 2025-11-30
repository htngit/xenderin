import { db } from '../db';
import { supabase } from '../supabase';
import { AssetFile } from '../services/types';

/**
 * Get all asset metadata from Supabase for a specific master user
 */
export async function getRemoteAssetMetadata(masterUserId: string): Promise<AssetFile[]> {
  try {
    // Query Supabase assets table - only get the fields that exist in Supabase
    // (avoid local-only fields like _deleted, _syncStatus, etc.)
    const { data, error } = await supabase
      .from('assets')
      .select(`
        id,
        name,
        file_name,
        file_size,
        file_type,
        file_url,
        uploaded_by,
        category,
        master_user_id,
        is_public,
        created_at,
        updated_at,
        mime_type
      `)
      .eq('master_user_id', masterUserId);

    if (error) {
      console.error('Error fetching remote asset metadata:', error);
      throw new Error(`Failed to fetch remote asset metadata: ${error.message}`);
    }

    return data as AssetFile[];
  } catch (error) {
    console.error('Error in getRemoteAssetMetadata:', error);
    throw error;
  }
}

/**
 * Get all asset metadata from local IndexedDB for a specific master user
 */
export async function getLocalAssetMetadata(masterUserId: string): Promise<AssetFile[]> {
  try {
    const localAssets = await db.assets
      .where('master_user_id')
      .equals(masterUserId)
      .and(asset => !asset._deleted)
      .toArray();

    // Transform local assets to match the AssetFile interface
    return localAssets.map(asset => ({
      id: asset.id,
      name: asset.name,
      file_name: asset.file_name,
      file_size: asset.file_size || asset.size || 0,
      file_type: asset.file_type || asset.type || '',
      file_url: asset.file_url || asset.url || '',
      uploaded_by: asset.uploaded_by,
      master_user_id: masterUserId, // Required property
      category: asset.category,
      is_public: asset.is_public,
      created_at: asset.created_at,
      updated_at: asset.updated_at,
      size: asset.size, // Legacy property
      type: asset.type, // Legacy property
      url: asset.url, // Legacy property
      uploadDate: asset.created_at,
      mime_type: asset.mime_type
    }));
  } catch (error) {
    console.error('Error in getLocalAssetMetadata:', error);
    throw error;
  }
}

/**
 * Compare local and remote asset metadata to find differences
 */
export async function compareAssetMetadata(
  masterUserId: string
): Promise<{
  missingInLocal: AssetFile[];
  missingInRemote: AssetFile[];
  upToDate: AssetFile[];
}> {
  try {
    const [remoteAssets, localAssets] = await Promise.all([
      getRemoteAssetMetadata(masterUserId),
      getLocalAssetMetadata(masterUserId)
    ]);

    const remoteAssetIds = new Set(remoteAssets.map(asset => asset.id));
    const localAssetIds = new Set(localAssets.map(asset => asset.id));

    // Assets that exist in remote but not in local (need to sync down to local)
    const missingInLocal = remoteAssets.filter(asset => !localAssetIds.has(asset.id));

    // Assets that exist in local but not in remote (possibly deleted from server)
    const missingInRemote = localAssets.filter(asset => !remoteAssetIds.has(asset.id));

    // Assets that exist in both (potentially need version comparison)
    const upToDate = localAssets.filter(asset => remoteAssetIds.has(asset.id));

    return {
      missingInLocal,
      missingInRemote,
      upToDate
    };
  } catch (error) {
    console.error('Error in compareAssetMetadata:', error);
    throw error;
  }
}

/**
 * Synchronize missing assets from Supabase to local IndexedDB
 */
export async function syncMissingAssetsToLocalStorage(masterUserId: string): Promise<{
  syncedCount: number;
  skippedCount: number;
  errorCount: number;
}> {
  try {
    console.log(`Starting asset sync for user: ${masterUserId}`);
    const comparison = await compareAssetMetadata(masterUserId);

    console.log(`Found ${comparison.missingInLocal.length} assets missing in local storage`);

    let syncedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Process each missing asset
    for (const asset of comparison.missingInLocal) {
      try {
        console.log(`Syncing asset: ${asset.name} (ID: ${asset.id})`);

        // Check if asset already exists in local DB to avoid duplication
        const existingLocalAsset = await db.assets.get(asset.id);
        if (existingLocalAsset) {
          console.log(`Asset ${asset.id} already exists locally, skipping`);
          skippedCount++;
          continue;
        }

        // Transform the asset to match LocalAsset interface for local storage
        const localAsset = {
          id: asset.id,
          name: asset.name,
          file_name: asset.file_name,
          file_size: asset.file_size,
          file_type: asset.file_type,
          file_url: asset.file_url,
          uploaded_by: asset.uploaded_by,
          category: asset.category,
          master_user_id: masterUserId,
          is_public: asset.is_public,
          mime_type: asset.mime_type || '',
          created_at: asset.created_at,
          updated_at: asset.updated_at,
          _syncStatus: 'synced' as const,
          _lastModified: new Date().toISOString(),
          _version: 1,
          _deleted: false
        };

        // Add to local database
        await db.assets.add(localAsset);
        console.log(`Successfully synced asset: ${asset.name} (ID: ${asset.id})`);
        syncedCount++;
      } catch (assetError) {
        console.error(`Error syncing asset ${asset.id}:`, assetError);
        errorCount++;
      }
    }

    console.log(`Asset sync completed. Synced: ${syncedCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`);
    return { syncedCount, skippedCount, errorCount };
  } catch (error) {
    console.error('Error in syncMissingAssetsToLocalStorage:', error);
    throw error;
  }
}
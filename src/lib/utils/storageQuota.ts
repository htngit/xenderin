// storageQuota.ts - Utility functions for managing storage quota

/**
 * Check available storage quota using the StorageManager API
 * @returns Object with available and used space information
 */
export async function checkStorageQuota(): Promise<{
  isSupported: boolean;
  quota?: number;      // Total quota in bytes
  usage?: number;      // Used space in bytes
  remaining?: number;  // Remaining space in bytes
  error?: string;
}> {
  try {
    // Check if StorageManager API is supported
    if (!navigator.storage || !navigator.storage.estimate) {
      return {
        isSupported: false,
        error: 'StorageManager API not supported in this browser'
      };
    }

    // Get storage estimate
    const estimate = await navigator.storage.estimate();

    return {
      isSupported: true,
      quota: estimate.quota,
      usage: estimate.usage,
      remaining: estimate.quota ? estimate.quota - (estimate.usage || 0) : undefined
    };
  } catch (error) {
    console.error('Error checking storage quota:', error);
    return {
      isSupported: true, // API exists, but call failed
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Request persistent storage permission
 * @returns Boolean indicating whether permission was granted
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    // Check if StorageManager API is supported
    if (!navigator.storage || !navigator.storage.persist) {
      console.warn('Persistent storage API not supported in this browser');
      return false;
    }

    // Check if storage is already persistent
    const isPersisted = await navigator.storage.persisted();
    if (isPersisted) {
      console.log('Storage is already persistent');
      return true;
    }

    // Request persistent storage
    const granted = await navigator.storage.persist();
    console.log(`Persistent storage ${granted ? 'granted' : 'denied'}`);
    return granted;
  } catch (error) {
    console.error('Error requesting persistent storage:', error);
    return false;
  }
}

/**
 * Check if device is in low storage state
 * @param thresholdPercentage - Percentage threshold (0-100) to consider as low storage
 * @returns Boolean indicating if storage is low
 */
export async function isLowStorage(thresholdPercentage: number = 90): Promise<boolean> {
  try {
    const quotaInfo = await checkStorageQuota();
    
    if (!quotaInfo.isSupported || !quotaInfo.quota || quotaInfo.error) {
      // If we can't check, assume it's not low
      return false;
    }

    const usagePercentage = (quotaInfo.usage! / quotaInfo.quota!) * 100;
    return usagePercentage >= thresholdPercentage;
  } catch (error) {
    console.error('Error checking low storage:', error);
    return false;
  }
}

/**
 * Show storage quota info in a user-friendly format
 * @returns Object with formatted storage information
 */
export async function getFormattedStorageInfo() {
  const quotaInfo = await checkStorageQuota();
  
  if (!quotaInfo.isSupported) {
    return {
      isSupported: false,
      formattedUsage: 'N/A',
      formattedQuota: 'N/A',
      usagePercentage: 0,
      warning: quotaInfo.error
    };
  }

  if (quotaInfo.error) {
    return {
      isSupported: true,
      formattedUsage: 'N/A',
      formattedQuota: 'N/A',
      usagePercentage: 0,
      warning: quotaInfo.error
    };
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const usage = quotaInfo.usage || 0;
  const quota = quotaInfo.quota || 0;
  const usagePercentage = quota > 0 ? (usage / quota) * 100 : 0;

  return {
    isSupported: true,
    formattedUsage: formatBytes(usage),
    formattedQuota: formatBytes(quota),
    formattedRemaining: formatBytes(quota - usage),
    usagePercentage: Math.round(usagePercentage * 100) / 100,
    isLowStorage: await isLowStorage(80) // Consider low if 80% or more is used
  };
}

/**
 * Get the cache usage percentage relative to our configured maximum
 * @param currentUsage - Current cache usage in bytes
 * @returns Percentage of configured max cache size used
 */
export function getCacheUsagePercentage(currentUsage: number): number {
  // Using the same maximum cache size as defined in CACHE_CONFIG
  const MAX_CACHE_SIZE = 500 * 1024 * 1024; // 500MB
  return (currentUsage / MAX_CACHE_SIZE) * 100;
}

/**
 * Check if the cache usage is approaching the configured maximum
 * @param currentUsage - Current cache usage in bytes
 * @param thresholdPercentage - Percentage threshold (default 80%) to consider as approaching limit
 * @returns Boolean indicating if cache is approaching limit
 */
export function isCacheApproachingLimit(currentUsage: number, thresholdPercentage: number = 80): boolean {
  const usagePercentage = getCacheUsagePercentage(currentUsage);
  return usagePercentage >= thresholdPercentage;
}

/**
 * Format a size in bytes for display
 * @param bytes - Size in bytes
 * @returns Formatted string with appropriate unit
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
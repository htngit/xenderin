// cacheConfig.ts - Configuration for asset caching strategies

/**
 * Define cache policies and configurations for asset caching
 */
export const CACHE_CONFIG = {
  // Maximum total cache size: 500MB
  MAX_CACHE_SIZE: 500 * 1024 * 1024,
  
  // Maximum individual asset size: 16MB (WhatsApp compatibility limit)
  MAX_ASSET_SIZE: 16 * 1024 * 1024,
  
  // Cache Time-to-Live: 30 days
  CACHE_TTL: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
  
  // Eviction strategy: LRU (Least Recently Used)
  EVICTION_STRATEGY: 'LRU' as const,
  
  // Prefetch configuration
  PREFETCH: {
    // Whether to enable automatic prefetching
    ENABLED: true,
    
    // Maximum number of assets to prefetch at once
    BATCH_SIZE: 10,
    
    // Bandwidth threshold (in Mbps) below which prefetching is throttled
    MIN_BANDWIDTH_FOR_PREFETCH: 2,
    
    // Whether to respect low battery mode
    RESPECT_LOW_BATTERY: true,
  },
  
  // Cache statistics and monitoring
  MONITORING: {
    // Enable cache statistics tracking
    ENABLED: true,
    
    // How often to update cache stats (in milliseconds)
    UPDATE_INTERVAL: 300000, // 5 minutes
  }
};

/**
 * Cache statistics interface
 */
export interface CacheStatistics {
  totalSize: number;
  assetCount: number;
  hitRate: number;
  missRate: number;
  evictionCount: number;
  lastUpdated: Date;
}

/**
 * Get cache statistics tracking instance
 */
class CacheStatsTracker {
  private stats: CacheStatistics = {
    totalSize: 0,
    assetCount: 0,
    hitRate: 0,
    missRate: 0,
    evictionCount: 0,
    lastUpdated: new Date(0)
  };

  private hitCount = 0;
  private missCount = 0;

  updateCacheSize(size: number, count: number) {
    this.stats.totalSize = size;
    this.stats.assetCount = count;
    this.stats.lastUpdated = new Date();
  }

  recordHit() {
    this.hitCount++;
    this.updateRates();
  }

  recordMiss() {
    this.missCount++;
    this.updateRates();
  }

  recordEviction() {
    this.stats.evictionCount++;
  }

  private updateRates() {
    const total = this.hitCount + this.missCount;
    if (total > 0) {
      this.stats.hitRate = this.hitCount / total;
      this.stats.missRate = this.missCount / total;
    }
  }

  getStats(): CacheStatistics {
    return { ...this.stats };
  }
}

export const cacheStatsTracker = new CacheStatsTracker();
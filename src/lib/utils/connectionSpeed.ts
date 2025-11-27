// connectionSpeed.ts - Utility functions for detecting network connection speed and type
import { nowISO } from '../utils/timestamp';

// Define speed thresholds (in Mbps)
export const SPEED_THRESHOLDS = {
  SLOW: 1,    // < 1 Mbps
  MEDIUM: 5,  // 1-5 Mbps
  FAST: 10    // > 10 Mbps
};

// Cached connection speed result with 5-minute TTL
let cachedSpeed: { speed: number; timestamp: string } | null = null;

/**
 * Check connection speed by downloading a small test file
 * @returns Speed in Mbps
 */
export async function checkConnectionSpeed(): Promise<number> {
  // Check if we have a cached result that's less than 5 minutes old
  if (cachedSpeed) {
    const now = new Date();
    const cachedTime = new Date(cachedSpeed.timestamp);
    const timeDiff = (now.getTime() - cachedTime.getTime()) / (1000 * 60); // minutes
  
    if (timeDiff < 5) {
      return cachedSpeed.speed;
    }
  }

  try {
    // Use a small test file to measure download speed
    const testFileSizeKB = 50; // 50KB test file
    const testUrl = `https://httpbin.org/bytes/${testFileSizeKB * 1024}?t=${Date.now()}`; // Add timestamp to prevent caching

    const startTime = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(testUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Read the response to actually measure download time
    await response.arrayBuffer();
    const endTime = performance.now();

    // Calculate speed in Mbps
    // (testFileSizeKB * 8) to convert KB to Kbits, then divide by time in seconds
    const timeSeconds = (endTime - startTime) / 1000;
    const speedMbps = (testFileSizeKB * 8) / (timeSeconds * 1024); // Convert to Mbps

    // Cache the result
    cachedSpeed = {
      speed: speedMbps,
      timestamp: nowISO()
    };

    return speedMbps;
  } catch (error) {
    console.warn('Failed to measure connection speed, using default slow speed:', error);
    // Return a conservative estimate if we can't measure
    return 0.5; // 0.5 Mbps (slow connection)
  }
}

/**
 * Get network connection type using Navigator API if available
 * @returns Connection type (wifi, cellular, ethernet, unknown)
 */
export function getConnectionType(): string {
  if (navigator && 'connection' in navigator) {
    // Use the Network Information API if available
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (connection && connection.effectiveType) {
      switch (connection.effectiveType) {
        case 'slow-2g':
        case '2g':
          return 'cellular';
        case '3g':
          return 'cellular';
        case '4g':
          return 'cellular';
        case '5g':
          return 'cellular';
        default:
          return 'unknown';
      }
    }
  }

  // Fallback to checking for other properties
  if (navigator && 'connection' in navigator) {
    const connection = (navigator as any).connection;
    if (connection && connection.type) {
      switch (connection.type) {
        case 'wifi':
        case 'wimax':
          return 'wifi';
        case 'cellular':
        case 'bluetooth':
          return 'cellular';
        case 'ethernet':
          return 'ethernet';
        default:
          return 'unknown';
      }
    }
  }

  // If no connection info is available, return unknown
  return 'unknown';
}

/**
 * Determine sync strategy based on connection speed
 * @param speed Connection speed in Mbps
 * @returns Sync strategy ('full', 'partial', 'background')
 */
export function getSyncStrategyBySpeed(speed: number): 'full' | 'partial' | 'background' {
  if (speed >= SPEED_THRESHOLDS.FAST) {
    return 'full';
  } else if (speed >= SPEED_THRESHOLDS.MEDIUM) {
    return 'partial';
  } else {
    return 'partial'; // For slow connections, use partial sync with background continuation
  }
}

/**
 * Get sync percentage based on connection speed
 * @param speed Connection speed in Mbps
 * @returns Sync percentage (0.5 for slow, 0.8 for medium, 1.0 for fast)
 */
export function getSyncPercentageBySpeed(speed: number): number {
  if (speed >= SPEED_THRESHOLDS.FAST) {
    return 1.0; // 100% sync for fast connections
  } else if (speed >= SPEED_THRESHOLDS.MEDIUM) {
    return 0.8; // 80% sync for medium connections
  } else {
    return 0.5; // 50% sync for slow connections
  }
}

/**
 * Clear cached connection speed
 */
export function clearConnectionSpeedCache(): void {
  cachedSpeed = null;
}
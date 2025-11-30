/**
 * Comprehensive timestamp utilities for consistent handling between Dexie (Date objects) 
 * and Supabase (ISO strings) in the XenderIn database sync system.
 * 
 * This utility addresses critical timestamp format inconsistencies that cause sync failures
 * by providing standardized conversion functions and metadata management.
 */

/**
 * Convert any date input to ISO 8601 string format
 * @param date - Date object, ISO string, or any date-like value
 * @returns ISO 8601 string format (e.g., "2025-11-15T16:06:01.243Z")
 */
export function toISOString(date: Date | string | number | null | undefined): string {
  if (!date) {
    return new Date().toISOString();
  }
  
  try {
    if (date instanceof Date) {
      return date.toISOString();
    }
    
    if (typeof date === 'string') {
      // Handle already ISO formatted strings
      if (date.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
        return date;
      }
      
      // Parse various string formats
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        console.warn(`Invalid date string provided: ${date}, using current time`);
        return new Date().toISOString();
      }
      return parsedDate.toISOString();
    }
    
    if (typeof date === 'number') {
      // Handle Unix timestamp (milliseconds)
      const dateObj = new Date(date);
      return dateObj.toISOString();
    }
    
    // Fallback for unknown types
    console.warn(`Unexpected date type: ${typeof date}, using current time`);
    return new Date().toISOString();
  } catch (error) {
    console.error(`Error converting date to ISO string:`, error, `Input:`, date);
    return new Date().toISOString();
  }
}

/**
 * Convert ISO 8601 string to Date object
 * @param isoString - ISO 8601 formatted string
 * @returns Date object
 */
export function fromISOString(isoString: string | Date | null | undefined): Date {
  if (!isoString) {
    return new Date();
  }
  
  try {
    if (isoString instanceof Date) {
      return isoString;
    }
    
    if (typeof isoString === 'string') {
      // Handle already ISO formatted strings
      if (isoString.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
        return new Date(isoString);
      }
      
      // Parse other string formats
      const parsedDate = new Date(isoString);
      if (isNaN(parsedDate.getTime())) {
        console.warn(`Invalid ISO string provided: ${isoString}, using current time`);
        return new Date();
      }
      return parsedDate;
    }
    
    // Fallback for unknown types
    console.warn(`Unexpected ISO string type: ${typeof isoString}, using current time`);
    return new Date();
  } catch (error) {
    console.error(`Error converting ISO string to Date:`, error, `Input:`, isoString);
    return new Date();
  }
}

/**
 * Normalize any timestamp value to the standardized format
 * @param value - Any timestamp format (Date, ISO string, number, null, undefined)
 * @returns Normalized ISO string
 */
export function normalizeTimestamp(value: any): string {
  return toISOString(value);
}

/**
 * Validate if a value is a valid timestamp format
 * @param value - Value to validate
 * @returns true if valid timestamp, false otherwise
 */
export function isValidTimestamp(value: any): boolean {
  if (!value) return false;
  
  try {
    const date = fromISOString(value);
    return !isNaN(date.getTime());
  } catch {
    return false;
  }
}

/**
 * Get current time in ISO 8601 format
 * @returns Current timestamp as ISO string
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Add standardized sync metadata to an object
 * @param obj - Object to add metadata to
 * @param isUpdate - Whether this is an update operation (default: false)
 * @returns Object with added metadata
 */
export function addSyncMetadata(obj: any, isUpdate: boolean = false): any {
  const now = nowISO();
  const metadata: any = {
    _syncStatus: 'pending' as const,
    _lastModified: now,
    _version: 1
  };

  if (isUpdate) {
    metadata._version = (obj._version || 0) + 1;
  }

  return {
    ...obj,
    ...metadata
  };
}

/**
 * Add standardized created_at and updated_at timestamps
 * @param obj - Object to add timestamps to
 * @param isUpdate - Whether this is an update operation (default: false)
 * @returns Object with added timestamps
 */
export function addTimestamps(obj: any, isUpdate: boolean = false): any {
  const now = nowISO();

  if (isUpdate) {
    return {
      ...obj,
      updated_at: now
    };
  }

  return {
    ...obj,
    created_at: now,
    updated_at: now
  };
}

/**
 * Transform data from Supabase format (ISO strings) to Dexie format (Date objects)
 * @param data - Data from Supabase
 * @returns Data with Date objects for timestamps
 */
export function supabaseToLocal(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }
  
  // Handle arrays (for queries that return multiple records)
  if (Array.isArray(data)) {
    return data.map(item => supabaseToLocal(item));
  }
  
  // Handle single objects
  const transformed = { ...data };
  
  // Convert timestamp fields from ISO strings to Date objects
  const timestampFields = [
    'created_at', 'updated_at', 'uploadDate', 'started_at', 'completed_at',
    'scheduled_for', 'reset_date', 'expires_at', 'completed_at'
  ];
  
  timestampFields.forEach(field => {
    if (transformed[field]) {
      try {
        transformed[field] = fromISOString(transformed[field]);
      } catch (error) {
        console.warn(`Failed to convert ${field} from ISO to Date:`, error);
        // Keep original value if conversion fails
      }
    }
  });
  
  // Convert _lastModified if it exists and is a string
  if (transformed._lastModified && typeof transformed._lastModified === 'string') {
    try {
      transformed._lastModified = fromISOString(transformed._lastModified);
    } catch (error) {
      console.warn(`Failed to convert _lastModified from ISO to Date:`, error);
    }
  }
  
  return transformed;
}

/**
 * Transform data from Dexie format (Date objects) to Supabase format (ISO strings)
 * @param data - Data from Dexie/local storage
 * @returns Data with ISO strings for timestamps
 */
export function localToSupabase(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }
  
  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => localToSupabase(item));
  }
  
  // Handle single objects
  const transformed = { ...data };
  
  // Convert timestamp fields from Date objects to ISO strings
  const timestampFields = [
    'created_at', 'updated_at', 'uploadDate', 'started_at', 'completed_at',
    'scheduled_for', 'reset_date', 'expires_at', 'completed_at'
  ];
  
  timestampFields.forEach(field => {
    if (transformed[field]) {
      try {
        transformed[field] = toISOString(transformed[field]);
      } catch (error) {
        console.warn(`Failed to convert ${field} from Date to ISO:`, error);
        // Keep original value if conversion fails
      }
    }
  });
  
  // Convert _lastModified if it exists and is a Date object
  if (transformed._lastModified && transformed._lastModified instanceof Date) {
    try {
      transformed._lastModified = toISOString(transformed._lastModified);
    } catch (error) {
      console.warn(`Failed to convert _lastModified from Date to ISO:`, error);
    }
  }
  
  return transformed;
}

/**
 * Ensure consistent timestamp format for a specific service type
 * @param data - Data to standardize
 * @param _serviceType - Type of service ('contact', 'template', 'group', 'history', 'asset', 'quota')
 * @returns Standardized data with ISO string timestamps
 */
export function standardizeForService(data: any, _serviceType: string): any {
  if (!data) return data;

  // Standardize all services to use ISO strings for consistency
  // This prevents sync corruption between TIMESTAMPTZ (Supabase) and Date objects (Dexie)
  return localToSupabase(data);
}

/**
 * Compare two timestamps for ordering
 * @param a - First timestamp
 * @param b - Second timestamp  
 * @returns Comparison result (-1, 0, 1)
 */
export function compareTimestamps(a: any, b: any): number {
  try {
    const dateA = fromISOString(a);
    const dateB = fromISOString(b);
    
    const timeA = dateA.getTime();
    const timeB = dateB.getTime();
    
    if (timeA < timeB) return -1;
    if (timeA > timeB) return 1;
    return 0;
  } catch (error) {
    console.error('Error comparing timestamps:', error);
    return 0;
  }
}

/**
 * Check if a timestamp is within a specified range
 * @param timestamp - Timestamp to check
 * @param startDate - Start of range
 * @param endDate - End of range
 * @returns true if timestamp is within range
 */
export function isWithinRange(timestamp: any, startDate: any, endDate: any): boolean {
  try {
    const ts = fromISOString(timestamp);
    const start = fromISOString(startDate);
    const end = fromISOString(endDate);
    
    return ts >= start && ts <= end;
  } catch (error) {
    console.error('Error checking timestamp range:', error);
    return false;
  }
}

/**
 * Get relative time string (e.g., "2 hours ago", "in 3 days")
 * @param timestamp - Timestamp to format
 * @returns Human readable relative time
 */
export function getRelativeTime(timestamp: any): string {
  try {
    const now = new Date();
    const target = fromISOString(timestamp);
    const diffMs = target.getTime() - now.getTime();
    const diffSeconds = Math.floor(Math.abs(diffMs) / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSeconds < 60) {
      return diffMs >= 0 ? 'in a few seconds' : 'a few seconds ago';
    }
    
    if (diffMinutes < 60) {
      const unit = diffMinutes === 1 ? 'minute' : 'minutes';
      return diffMs >= 0 ? `in ${diffMinutes} ${unit}` : `${diffMinutes} ${unit} ago`;
    }
    
    if (diffHours < 24) {
      const unit = diffHours === 1 ? 'hour' : 'hours';
      return diffMs >= 0 ? `in ${diffHours} ${unit}` : `${diffHours} ${unit} ago`;
    }
    
    if (diffDays < 7) {
      const unit = diffDays === 1 ? 'day' : 'days';
      return diffMs >= 0 ? `in ${diffDays} ${unit}` : `${diffDays} ${unit} ago`;
    }
    
    // For longer periods, return formatted date
    return target.toLocaleDateString();
  } catch (error) {
    console.error('Error formatting relative time:', error);
    return 'Unknown time';
  }
}
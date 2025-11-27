// SyncPriority.ts - Define data priority levels for sync operations

/**
 * Define data priority levels for sync operations based on business importance
 */
export enum SyncPriority {
  CRITICAL = 1,   // Quota, profile - essential for app functionality
  HIGH = 2,       // Contacts, templates - needed for core operations
  MEDIUM = 3,     // Assets - important but larger files
  LOW = 4         // History, logs - background data
}

/**
 * Map table names to their sync priority levels
 */
export const TABLE_SYNC_PRIORITIES: Record<string, SyncPriority> = {
  // Critical tables - essential for app functionality
  'quotas': SyncPriority.CRITICAL,
  'profiles': SyncPriority.CRITICAL,

  // High priority tables - needed for core operations
  'contacts': SyncPriority.HIGH,
  'templates': SyncPriority.HIGH,

  // Medium priority tables - important but potentially larger
  'assets': SyncPriority.MEDIUM,

  // Low priority tables - background data
  'activityLogs': SyncPriority.LOW,
  'groups': SyncPriority.LOW,
  'payments': SyncPriority.LOW,
  'quotaReservations': SyncPriority.LOW,
  'userSessions': SyncPriority.LOW
};

/**
 * Get priority level for a specific table
 */
export function getTablePriority(tableName: string): SyncPriority {
  return TABLE_SYNC_PRIORITIES[tableName] || SyncPriority.LOW;
}

/**
 * Get table names for a specific priority level
 */
export function getTablesForPriority(priority: SyncPriority): string[] {
  return Object.entries(TABLE_SYNC_PRIORITIES)
    .filter(([, tablePriority]) => tablePriority === priority)
    .map(([tableName]) => tableName);
}

/**
 * Get tables grouped by priority for sync operations
 */
export function getTablesByPriority(): {
  critical: string[];
  high: string[];
  medium: string[];
  low: string[];
} {
  return {
    critical: getTablesForPriority(SyncPriority.CRITICAL),
    high: getTablesForPriority(SyncPriority.HIGH),
    medium: getTablesForPriority(SyncPriority.MEDIUM),
    low: getTablesForPriority(SyncPriority.LOW)
  };
}
import Dexie, { Table } from 'dexie';
import {
  Contact,
  ContactGroup,
  Template,
  ActivityLog,
  AssetFile,
  Quota
} from './services/types';
import {
  addSyncMetadata,
  addTimestamps,
  nowISO
} from './utils/timestamp';

// Dexie schema interfaces with sync metadata
export interface LocalContact extends Contact {
  _syncStatus: 'pending' | 'synced' | 'conflict' | 'error';
  _lastModified: string;
  _version: number;
  _deleted: boolean;
}

export interface LocalGroup extends Omit<ContactGroup, 'master_user_id' | 'created_by'> {
  master_user_id: string;
  created_by: string;
  _syncStatus: 'pending' | 'synced' | 'conflict' | 'error';
  _lastModified: string;
  _version: number;
  _deleted: boolean;
}

export interface LocalTemplate extends Template {
  category: string;
  _syncStatus: 'pending' | 'synced' | 'conflict' | 'error';
  _lastModified: string;
  _version: number;
  _deleted: boolean;
}

export interface LocalActivityLog extends ActivityLog {
  _syncStatus: 'pending' | 'synced' | 'conflict' | 'error';
  _lastModified: string;
  _version: number;
  _deleted: boolean;
}

export interface LocalAsset extends Omit<AssetFile, 'uploadDate'> {
  file_name: string;
  uploaded_by: string; // UUID
  mime_type: string;
  is_public: boolean;
  master_user_id: string;
  created_at: string;
  updated_at: string;
  _syncStatus: 'pending' | 'synced' | 'conflict' | 'error';
  _lastModified: string;
  _version: number;
  _deleted: boolean;
  _localPath?: string;
}

export interface LocalQuota extends Quota {
  _syncStatus: 'pending' | 'synced' | 'conflict' | 'error';
  _lastModified: string;
  _version: number;
}

export interface LocalQuotaReservation {
  id: string;
  user_id: string;
  master_user_id: string;
  quota_id?: string;
  amount: number;
  status: 'pending' | 'committed' | 'cancelled' | 'expired';
  expires_at?: string;
  committed_at?: string;
  created_at: string;
  updated_at: string;
  _syncStatus: 'pending' | 'synced' | 'conflict' | 'error';
  _lastModified: string;
  _version: number;
  _deleted?: boolean;
}

// Missing table interfaces - profiles
export interface LocalProfile {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'staff';
  master_user_id: string;
  phone_number?: string;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  _syncStatus: 'pending' | 'synced' | 'conflict' | 'error';
  _lastModified: string;
  _version: number;
  _deleted?: boolean;
}

// Missing table interfaces - payments
export interface LocalPayment {
  id: string;
  user_id: string;
  master_user_id: string;
  payment_id: string;
  duitku_transaction_id?: string;
  plan_type: 'basic' | 'premium' | 'enterprise';
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'expired';
  payment_method?: string;
  qr_url?: string;
  payment_url?: string;
  expires_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  _syncStatus: 'pending' | 'synced' | 'conflict' | 'error';
  _lastModified: string;
  _version: number;
  _deleted?: boolean;
}

// Missing table interfaces - user_sessions (for offline auth)
export interface LocalUserSession {
  id: string;
  master_user_id: string;
  session_token: string;
  expires_at: string;
  created_at: string;
  last_active: string;
  is_active: boolean;
  ip_address?: string;
  user_agent?: string;
  _syncStatus: 'pending' | 'synced' | 'conflict' | 'error';
  _lastModified: string;
  _version: number;
  _deleted?: boolean;
}

export interface LocalAssetBlob {
  asset_id: string;
  blob: Blob;
  mime_type: string;
  size: number;
  cached_at: string;
  last_accessed: string;
  _version: number;
}

export interface LocalMessageJob {
  id: string;
  reservation_id: string;
  user_id: string;
  master_user_id: string;
  contact_group_id?: string;
  template_id: string;
  total_contacts: number;
  success_count: number;
  failed_count: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  config: {
    sendingMode: 'static' | 'dynamic';
    delayRange: [number, number];
  };
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  _syncStatus: 'pending' | 'synced' | 'conflict' | 'error';
  _lastModified: string;
  _version: number;
  _deleted?: boolean;
}

export interface SyncOperation {
  id?: number;
  table: string;
  operation: 'create' | 'update' | 'delete';
  recordId: string;
  data: any;
  timestamp: string;
  retryCount: number;
  lastAttempt?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

// Extended database class with sync support
export class AppDatabase extends Dexie {
  contacts!: Table<LocalContact>;
  groups!: Table<LocalGroup>;
  templates!: Table<LocalTemplate>;
  activityLogs!: Table<LocalActivityLog>;
  assets!: Table<LocalAsset>;
  quotas!: Table<LocalQuota>;
  quotaReservations!: Table<LocalQuotaReservation>;
  profiles!: Table<LocalProfile>;
  payments!: Table<LocalPayment>;
  userSessions!: Table<LocalUserSession>;
  syncQueue!: Table<SyncOperation>;
  asset_blobs!: Table<LocalAssetBlob>;
  messageJobs!: Table<LocalMessageJob>;

  constructor() {
    super('XenderInDatabase');

    // Version 1 - Original schema
    this.version(1).stores({
      contacts: '&id, name, phone, group_id, master_user_id, _syncStatus, _lastModified, _version, _deleted',
      groups: '&id, name, master_user_id, _syncStatus, _lastModified, _version, _deleted',
      templates: '&id, name, master_user_id, category, _syncStatus, _lastModified, _version, _deleted',
      activityLogs: '&id, master_user_id, status, template_name, _syncStatus, _lastModified, _version, _deleted',
      assets: '&id, name, type, category, master_user_id, _syncStatus, _lastModified, _version, _deleted',
      quotas: '&id, user_id, master_user_id, plan_type, _syncStatus, _lastModified, _version',
      quotaReservations: '&id, user_id, master_user_id, status, _syncStatus, _lastModified, _version',
      syncQueue: '++id, table, operation, recordId, status, timestamp, retryCount'
    });

    // Version 2 - Add missing tables (profiles, payments, user_sessions)
    this.version(2).stores({
      contacts: '&id, name, phone, group_id, master_user_id, _syncStatus, _lastModified, _version, _deleted',
      groups: '&id, name, master_user_id, _syncStatus, _lastModified, _version, _deleted',
      templates: '&id, name, master_user_id, category, _syncStatus, _lastModified, _version, _deleted',
      activityLogs: '&id, master_user_id, status, template_name, _syncStatus, _lastModified, _version, _deleted',
      assets: '&id, name, type, category, master_user_id, _syncStatus, _lastModified, _version, _deleted',
      quotas: '&id, user_id, master_user_id, plan_type, _syncStatus, _lastModified, _version',
      quotaReservations: '&id, user_id, master_user_id, status, _syncStatus, _lastModified, _version',
      profiles: '&id, email, master_user_id, role, is_active, _syncStatus, _lastModified, _version',
      payments: '&id, user_id, master_user_id, payment_id, status, plan_type, _syncStatus, _lastModified, _version',
      userSessions: '&id, master_user_id, session_token, expires_at, _syncStatus, _lastModified, _version',
      syncQueue: '++id, table, operation, recordId, status, timestamp, retryCount'
    });

    // Version 3 - Update assets table to include timestamp fields and userSessions fields
    this.version(3).stores({
      contacts: '&id, name, phone, group_id, master_user_id, _syncStatus, _lastModified, _version, _deleted',
      groups: '&id, name, master_user_id, _syncStatus, _lastModified, _version, _deleted',
      templates: '&id, name, master_user_id, category, _syncStatus, _lastModified, _version, _deleted',
      activityLogs: '&id, master_user_id, status, template_name, _syncStatus, _lastModified, _version, _deleted',
      assets: '&id, name, type, category, master_user_id, _syncStatus, _lastModified, _version, _deleted',
      quotas: '&id, user_id, master_user_id, plan_type, _syncStatus, _lastModified, _version',
      quotaReservations: '&id, user_id, master_user_id, status, _syncStatus, _lastModified, _version',
      profiles: '&id, email, master_user_id, role, is_active, _syncStatus, _lastModified, _version',
      payments: '&id, user_id, master_user_id, payment_id, status, plan_type, _syncStatus, _lastModified, _version',
      userSessions: '&id, master_user_id, session_token, expires_at, last_active, is_active, _syncStatus, _lastModified, _version',
      syncQueue: '++id, table, operation, recordId, status, timestamp, retryCount'
    });

    // Version 4 - Add missing indexed fields and update schema to match Supabase
    this.version(4).stores({
      contacts: '&id, name, phone, group_id, master_user_id, created_by, tags, notes, is_blocked, last_interaction, _syncStatus, _lastModified, _version, _deleted',
      groups: '&id, name, master_user_id, created_by, _syncStatus, _lastModified, _version, _deleted',
      templates: '&id, name, master_user_id, category, _syncStatus, _lastModified, _version, _deleted',
      activityLogs: '&id, user_id, master_user_id, contact_group_id, template_id, status, template_name, total_contacts, success_count, failed_count, delay_range, scheduled_for, started_at, completed_at, error_message, metadata, _syncStatus, _lastModified, _version, _deleted',
      assets: '&id, name, type, category, master_user_id, file_name, uploaded_by, mime_type, is_public, _syncStatus, _lastModified, _version, _deleted',
      quotas: '&id, user_id, master_user_id, plan_type, messages_limit, messages_used, reset_date, is_active, _syncStatus, _lastModified, _version',
      quotaReservations: '&id, user_id, master_user_id, status, _syncStatus, _lastModified, _version',
      profiles: '&id, email, name, master_user_id, phone_number, avatar_url, role, is_active, _syncStatus, _lastModified, _version',
      payments: '&id, user_id, master_user_id, payment_id, duitku_transaction_id, amount, currency, status, payment_method, qr_url, payment_url, expires_at, completed_at, plan_type, _syncStatus, _lastModified, _version',
      userSessions: '&id, master_user_id, session_token, expires_at, last_active, is_active, _syncStatus, _lastModified, _version',
      syncQueue: '++id, table, operation, recordId, status, timestamp, retryCount'
    });

    // Version 5 - Add asset_blobs table for caching
    this.version(5).stores({
      contacts: '&id, name, phone, group_id, master_user_id, created_by, tags, notes, is_blocked, last_interaction, _syncStatus, _lastModified, _version, _deleted',
      groups: '&id, name, master_user_id, created_by, _syncStatus, _lastModified, _version, _deleted',
      templates: '&id, name, master_user_id, category, _syncStatus, _lastModified, _version, _deleted',
      activityLogs: '&id, user_id, master_user_id, contact_group_id, template_id, status, template_name, total_contacts, success_count, failed_count, delay_range, scheduled_for, started_at, completed_at, error_message, metadata, _syncStatus, _lastModified, _version, _deleted',
      assets: '&id, name, type, category, master_user_id, file_name, uploaded_by, mime_type, is_public, _syncStatus, _lastModified, _version, _deleted',
      quotas: '&id, user_id, master_user_id, plan_type, messages_limit, messages_used, reset_date, is_active, _syncStatus, _lastModified, _version',
      quotaReservations: '&id, user_id, master_user_id, status, _syncStatus, _lastModified, _version',
      profiles: '&id, email, name, master_user_id, phone_number, avatar_url, role, is_active, _syncStatus, _lastModified, _version',
      payments: '&id, user_id, master_user_id, payment_id, duitku_transaction_id, amount, currency, status, payment_method, qr_url, payment_url, expires_at, completed_at, plan_type, _syncStatus, _lastModified, _version',
      userSessions: '&id, master_user_id, session_token, expires_at, last_active, is_active, _syncStatus, _lastModified, _version',
      syncQueue: '++id, table, operation, recordId, status, timestamp, retryCount',
      asset_blobs: '&asset_id, size, cached_at, last_accessed'
    });

    // Version 6 - Add messageJobs table for WAL
    this.version(6).stores({
      contacts: '&id, name, phone, group_id, master_user_id, created_by, tags, notes, is_blocked, last_interaction, _syncStatus, _lastModified, _version, _deleted',
      groups: '&id, name, master_user_id, created_by, _syncStatus, _lastModified, _version, _deleted',
      templates: '&id, name, master_user_id, category, _syncStatus, _lastModified, _version, _deleted',
      activityLogs: '&id, user_id, master_user_id, contact_group_id, template_id, status, template_name, total_contacts, success_count, failed_count, delay_range, scheduled_for, started_at, completed_at, error_message, metadata, _syncStatus, _lastModified, _version, _deleted',
      assets: '&id, name, type, category, master_user_id, file_name, uploaded_by, mime_type, is_public, _syncStatus, _lastModified, _version, _deleted',
      quotas: '&id, user_id, master_user_id, plan_type, messages_limit, messages_used, reset_date, is_active, _syncStatus, _lastModified, _version',
      quotaReservations: '&id, user_id, master_user_id, status, _syncStatus, _lastModified, _version',
      profiles: '&id, email, name, master_user_id, phone_number, avatar_url, role, is_active, _syncStatus, _lastModified, _version',
      payments: '&id, user_id, master_user_id, payment_id, duitku_transaction_id, amount, currency, status, payment_method, qr_url, payment_url, expires_at, completed_at, plan_type, _syncStatus, _lastModified, _version',
      userSessions: '&id, master_user_id, session_token, expires_at, last_active, is_active, _syncStatus, _lastModified, _version',
      syncQueue: '++id, table, operation, recordId, status, timestamp, retryCount',
      asset_blobs: '&asset_id, size, cached_at, last_accessed',
      messageJobs: '&id, reservation_id, user_id, master_user_id, status, created_at'
    });

    // Version 7 - Add master_user_id index to messageJobs table to fix clearUserData error
    this.version(7).stores({
      contacts: '&id, name, phone, group_id, master_user_id, created_by, tags, notes, is_blocked, last_interaction, _syncStatus, _lastModified, _version, _deleted',
      groups: '&id, name, master_user_id, created_by, _syncStatus, _lastModified, _version, _deleted',
      templates: '&id, name, master_user_id, category, _syncStatus, _lastModified, _version, _deleted',
      activityLogs: '&id, user_id, master_user_id, contact_group_id, template_id, status, template_name, total_contacts, success_count, failed_count, delay_range, scheduled_for, started_at, completed_at, error_message, metadata, _syncStatus, _lastModified, _version, _deleted',
      assets: '&id, name, type, category, master_user_id, file_name, uploaded_by, mime_type, is_public, _syncStatus, _lastModified, _version, _deleted',
      quotas: '&id, user_id, master_user_id, plan_type, messages_limit, messages_used, reset_date, is_active, _syncStatus, _lastModified, _version',
      quotaReservations: '&id, user_id, master_user_id, status, _syncStatus, _lastModified, _version',
      profiles: '&id, email, name, master_user_id, phone_number, avatar_url, role, is_active, _syncStatus, _lastModified, _version',
      payments: '&id, user_id, master_user_id, payment_id, duitku_transaction_id, amount, currency, status, payment_method, qr_url, payment_url, expires_at, completed_at, plan_type, _syncStatus, _lastModified, _version',
      userSessions: '&id, master_user_id, session_token, expires_at, last_active, is_active, _syncStatus, _lastModified, _version',
      syncQueue: '++id, table, operation, recordId, status, timestamp, retryCount',
      asset_blobs: '&asset_id, size, cached_at, last_accessed',
      messageJobs: '&id, reservation_id, user_id, master_user_id, status, created_at'
    });

    // Hooks for automatic sync status and timestamp management using standardized utilities
    this.contacts.hook('creating', this.onCreating.bind(this));
    this.contacts.hook('updating', this.onUpdating.bind(this));
    this.contacts.hook('deleting', this.onDeleting.bind(this));

    this.groups.hook('creating', this.onCreating.bind(this));
    this.groups.hook('updating', this.onUpdating.bind(this));
    this.groups.hook('deleting', this.onDeleting.bind(this));

    this.templates.hook('creating', this.onCreating.bind(this));
    this.templates.hook('updating', this.onUpdating.bind(this));
    this.templates.hook('deleting', this.onDeleting.bind(this));

    this.activityLogs.hook('creating', this.onCreating.bind(this));
    this.activityLogs.hook('updating', this.onUpdating.bind(this));
    this.activityLogs.hook('deleting', this.onDeleting.bind(this));

    this.assets.hook('creating', this.onCreating.bind(this));
    this.assets.hook('updating', this.onUpdating.bind(this));
    this.assets.hook('deleting', this.onDeleting.bind(this));

    this.quotas.hook('creating', this.onCreating.bind(this));
    this.quotas.hook('updating', this.onUpdating.bind(this));

    this.quotaReservations.hook('creating', this.onCreating.bind(this));
    this.quotaReservations.hook('updating', this.onUpdating.bind(this));
    this.quotaReservations.hook('deleting', this.onDeleting.bind(this));

    // Hooks for new tables
    this.profiles.hook('creating', this.onCreating.bind(this));
    this.profiles.hook('updating', this.onUpdating.bind(this));
    this.profiles.hook('deleting', this.onDeleting.bind(this));

    this.payments.hook('creating', this.onCreating.bind(this));
    this.payments.hook('updating', this.onUpdating.bind(this));
    this.payments.hook('deleting', this.onDeleting.bind(this));

    this.userSessions.hook('creating', this.onCreating.bind(this));
    this.userSessions.hook('updating', this.onUpdating.bind(this));
    this.userSessions.hook('deleting', this.onDeleting.bind(this));

    this.messageJobs.hook('creating', this.onCreating.bind(this));
    this.messageJobs.hook('updating', this.onUpdating.bind(this));
  }

  /**
   * Enhanced creating hook with standardized timestamp utilities
   */
  private onCreating(primKey: any, obj: any, trans: any) {
    // Add standardized sync metadata
    const syncMetadata = addSyncMetadata(obj, false);

    // Add standardized timestamps
    const timestamps = addTimestamps(obj, false);

    // Apply standardized properties
    obj._syncStatus = syncMetadata._syncStatus;
    obj._lastModified = syncMetadata._lastModified;
    obj._version = syncMetadata._version;
    obj._deleted = false;

    // Apply timestamps if the object doesn't have them
    if (!obj.created_at) obj.created_at = timestamps.created_at;
    if (!obj.updated_at) obj.updated_at = timestamps.updated_at;
  }

  /**
   * Enhanced updating hook with standardized timestamp utilities
   */
  private onUpdating(modifications: any, primKey: any, obj: any, trans: any) {
    // Add standardized sync metadata
    const syncMetadata = addSyncMetadata(obj, true);

    // Apply standardized properties
    modifications._syncStatus = syncMetadata._syncStatus;
    modifications._lastModified = syncMetadata._lastModified;
    modifications._version = syncMetadata._version;

    // Update timestamp
    modifications.updated_at = nowISO();
  }

  /**
   * Enhanced deleting hook with standardized timestamp utilities
   */
  private onDeleting(primKey: any, obj: any, trans: any) {
    // Add standardized sync metadata for soft delete
    const syncMetadata = addSyncMetadata(obj, true);

    // Convert soft delete to update with standardized metadata
    const softDeleteData = {
      _syncStatus: syncMetadata._syncStatus,
      _lastModified: syncMetadata._lastModified,
      _version: syncMetadata._version,
      _deleted: true,
      updated_at: nowISO()
    };

    // Apply soft delete to the current table
    return this.table(obj.tableName || 'contacts').update(primKey, softDeleteData);
  }

  /**
   * Get all tables that need syncing
   * NOTE: All these tables now exist in Supabase schema
   */
  getSyncableTables() {
    return [
      'contacts',
      'groups',           // maps to 'groups' table
      'templates',
      'activityLogs',     // maps to 'history' table
      'assets',
      'quotas',           // maps to 'user_quotas' table
      'quotaReservations', // maps to 'quota_reservations' table
      'profiles',
      'payments',
      'userSessions'      // maps to 'user_sessions' table
    ];
  }

  /**
   * Clear all data for a specific user (for logout/cleanup)
   */
  async clearUserData(masterUserId: string) {
    // First, get all asset IDs for this user so we can clean up associated blobs
    const userAssets = await this.assets.where('master_user_id').equals(masterUserId).toArray();
    const assetIds = userAssets.map(asset => asset.id);

    // Delete data from all tables where master_user_id matches
    await Promise.all([
      this.contacts.where('master_user_id').equals(masterUserId).delete(),
      this.groups.where('master_user_id').equals(masterUserId).delete(),
      this.templates.where('master_user_id').equals(masterUserId).delete(),
      this.activityLogs.where('master_user_id').equals(masterUserId).delete(),
      this.assets.where('master_user_id').equals(masterUserId).delete(),
      this.quotas.where('master_user_id').equals(masterUserId).delete(),
      this.quotaReservations.where('master_user_id').equals(masterUserId).delete(),
      this.profiles.where('master_user_id').equals(masterUserId).delete(),
      this.payments.where('master_user_id').equals(masterUserId).delete(),
      this.userSessions.where('master_user_id').equals(masterUserId).delete(),
      // Note: syncQueue doesn't have master_user_id field, so we skip it
      this.messageJobs.where('master_user_id').equals(masterUserId).delete(),
    ]);

    // Delete asset blobs for the user's assets
    if (assetIds.length > 0) {
      await this.asset_blobs.where('asset_id').anyOf(assetIds).delete();
    }
  }

  /**
   * Clear all data for a specific user including asset blobs (alternative approach)
   */
  async clearUserDataWithBlobs(masterUserId: string) {
    try {
      // Log cleanup operation
      console.log(`Starting cleanup for user: ${masterUserId}`);

      // Delete data from all tables where master_user_id matches
      const deletePromises = [
        this.contacts.where('master_user_id').equals(masterUserId).delete(),
        this.groups.where('master_user_id').equals(masterUserId).delete(),
        this.templates.where('master_user_id').equals(masterUserId).delete(),
        this.activityLogs.where('master_user_id').equals(masterUserId).delete(),
        this.assets.where('master_user_id').equals(masterUserId).delete(),
        this.quotas.where('master_user_id').equals(masterUserId).delete(),
        this.quotaReservations.where('master_user_id').equals(masterUserId).delete(),
        this.profiles.where('master_user_id').equals(masterUserId).delete(),
        this.payments.where('master_user_id').equals(masterUserId).delete(),
        this.userSessions.where('master_user_id').equals(masterUserId).delete(),
        // Note: syncQueue doesn't have master_user_id field, so we skip it
        this.messageJobs.where('master_user_id').equals(masterUserId).delete(),
      ];

      // Execute all deletion operations in parallel
      await Promise.all(deletePromises);

      // Clear all asset blobs since they're not tied to a specific user but to specific assets
      // In a multi-user scenario, we might need a different approach
      await this.asset_blobs.clear();

      console.log(`Cleanup completed for user: ${masterUserId}`);
    } catch (error) {
      console.error('Error during user data cleanup:', error);
      throw error;
    }
  }

  /**
   * Clear all data and reset to fresh state (for logout/uninstall)
   */
  async clearAllData() {
    try {
      // Clear all tables
      await Promise.all([
        this.contacts.clear(),
        this.groups.clear(),
        this.templates.clear(),
        this.activityLogs.clear(),
        this.assets.clear(),
        this.quotas.clear(),
        this.quotaReservations.clear(),
        this.profiles.clear(),
        this.payments.clear(),
        this.userSessions.clear(),
        this.syncQueue.clear(),
        this.asset_blobs.clear(),
        this.messageJobs.clear()
      ]);

      console.log('All data cleared successfully');
    } catch (error) {
      console.error('Error clearing all data:', error);
      throw error;
    }
  }

  /**
   * Get unsynced records count
   */
  async getUnsyncedCount(): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};

    for (const tableName of this.getSyncableTables()) {
      const table = this.table(tableName as any) as Table<any>;
      const count = await table.where('_syncStatus').equals('pending').count();
      counts[tableName] = count;
    }

    return counts;
  }

  /**
   * Get all pending sync operations
   */
  async getPendingSyncOperations(): Promise<SyncOperation[]> {
    return this.syncQueue
      .where('status')
      .equals('pending')
      .toArray();
  }

  /**
   * Get database version info
   */
  getVersionInfo() {
    return {
      version: this.verno,
      schemaVersion: 4,
      name: this.name,
      tables: this.getSyncableTables()
    };
  }
}

// Create database instance
export const db = new AppDatabase();
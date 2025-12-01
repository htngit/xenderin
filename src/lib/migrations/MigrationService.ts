import { db } from '../db';
import {
  LocalContact,
  LocalGroup,
  LocalActivityLog,
  LocalAsset,
  LocalQuota,
  LocalProfile,
  LocalPayment
} from '../db';
import { nowISO, normalizeTimestamp } from '../utils/timestamp';
import { validateData } from '../utils/validation';

// Migration metadata interface
export interface MigrationMetadata {
  version: number;
  timestamp: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  error?: string;
  recordsProcessed: number;
  recordsFailed: number;
}

// Migration step interface
export interface MigrationStep {
  id: string;
  description: string;
  execute: () => Promise<void>;
  rollback?: () => Promise<void>;
}

// Migration service class
export class MigrationService {
  private static readonly MIGRATION_METADATA_KEY = 'migration_metadata';

  /**
   * Check if database needs migration
   */
  async needsMigration(): Promise<boolean> {
    const currentVersion = db.verno;
    const schemaVersion = 4; // Current schema version
    return currentVersion < schemaVersion;
  }

  /**
   * Get current migration metadata
   */
  async getMigrationMetadata(): Promise<MigrationMetadata | null> {
    try {
      const metadata = localStorage.getItem(MigrationService.MIGRATION_METADATA_KEY);
      return metadata ? JSON.parse(metadata) : null;
    } catch (error) {
      console.error('Error reading migration metadata:', error);
      return null;
    }
  }

  /**
    * Save migration metadata
    */
  async saveMigrationMetadata(metadata: MigrationMetadata): Promise<void> {
    try {
      localStorage.setItem(MigrationService.MIGRATION_METADATA_KEY, JSON.stringify(metadata));
    } catch (error) {
      console.error('Error saving migration metadata:', error);
      throw error;
    }
  }

  /**
   * Perform migration from current version to target version
   */
  async migrate(): Promise<void> {
    const needsMigration = await this.needsMigration();
    if (!needsMigration) {
      console.log('Database is already up to date');
      return;
    }

    const metadata: MigrationMetadata = {
      version: 4,
      timestamp: nowISO(),
      status: 'pending',
      recordsProcessed: 0,
      recordsFailed: 0
    };

    await this.saveMigrationMetadata(metadata);

    try {
      // Update status to in progress
      metadata.status = 'in_progress';
      await this.saveMigrationMetadata(metadata);

      // Get all migration steps
      const migrationSteps = await this.getMigrationSteps();

      // Execute each migration step
      for (const step of migrationSteps) {
        console.log(`Executing migration step: ${step.description}`);
        await step.execute();
      }

      // Migration completed successfully
      metadata.status = 'completed';
      metadata.timestamp = nowISO();
      await this.saveMigrationMetadata(metadata);

      console.log('Database migration completed successfully');
    } catch (error) {
      console.error('Migration failed:', error);
      metadata.status = 'failed';
      metadata.error = error instanceof Error ? error.message : 'Unknown error';
      await this.saveMigrationMetadata(metadata);
      throw error;
    }
  }

  /**
   * Get all migration steps needed to upgrade to version 4
   */
  private async getMigrationSteps(): Promise<MigrationStep[]> {
    const currentVersion = db.verno;
    const steps: MigrationStep[] = [];

    // Version 1 to 2: Add profiles, payments, user_sessions tables
    if (currentVersion < 2) {
      steps.push({
        id: 'v1_to_v2',
        description: 'Add profiles, payments, and user_sessions tables',
        execute: () => this.migrateV1ToV2(),
        rollback: () => this.rollbackV2ToV1()
      });
    }

    // Version 2 to 3: Update userSessions fields
    if (currentVersion < 3) {
      steps.push({
        id: 'v2_to_v3',
        description: 'Update userSessions with additional fields',
        execute: () => this.migrateV2ToV3(),
        rollback: () => this.rollbackV3ToV2()
      });
    }

    // Version 3 to 4: Add missing indexed fields and update schema to match Supabase
    if (currentVersion < 4) {
      steps.push({
        id: 'v3_to_v4',
        description: 'Add missing indexed fields and update schema to match Supabase',
        execute: () => this.migrateV3ToV4(),
        rollback: () => this.rollbackV4ToV3()
      });
    }

    return steps;
  }

  /**
   * Migrate from version 1 to 2: Add profiles, payments, user_sessions tables
   */
  private async migrateV1ToV2(): Promise<void> {
    console.log('Starting migration from v1 to v2');

    // Create new tables if they don't exist
    try {
      // The Dexie schema upgrade should handle this automatically
      // But we'll ensure the tables exist with proper indexes
      await db.transaction('rw', db.profiles, db.payments, db.userSessions, async () => {
        // Create default profile if needed
        const existingProfiles = await db.profiles.count();
        if (existingProfiles === 0) {
          // Create a default profile for migration purposes
          const defaultProfile: LocalProfile = {
            id: 'default_profile',
            email: 'default@example.com',
            name: 'Default User',
            role: 'owner',
            master_user_id: 'default_master',
            phone_number: '',
            avatar_url: '',
            is_active: true,
            created_at: nowISO(),
            updated_at: nowISO(),
            _syncStatus: 'synced',
            _lastModified: nowISO(),
            _version: 1
          };

          await db.profiles.add(defaultProfile);
        }
      });
    } catch (error) {
      console.error('Error during v1 to v2 migration:', error);
      throw error;
    }
  }

  /**
   * Rollback from version 2 to 1
   */
  private async rollbackV2ToV1(): Promise<void> {
    console.log('Rolling back from v2 to v1');
    // For a proper rollback, we would need to drop the new tables
    // This is a simplified version - in production, consider data preservation
    await db.transaction('rw', db.profiles, db.payments, db.userSessions, async () => {
      await db.profiles.clear();
      await db.payments.clear();
      await db.userSessions.clear();
    });
  }

  /**
   * Migrate from version 2 to 3: Update userSessions fields
   */
  private async migrateV2ToV3(): Promise<void> {
    console.log('Starting migration from v2 to v3');

    // Update existing user sessions with new fields
    const sessions = await db.userSessions.toArray();
    const updatePromises = sessions.map(session => {
      const updatedSession = {
        ...session,
        last_active: session.last_active || nowISO(),
        is_active: session.is_active !== undefined ? session.is_active : true
      };
      return db.userSessions.put(updatedSession);
    });

    await Promise.all(updatePromises);
  }

  /**
   * Rollback from version 3 to 2
   */
  private async rollbackV3ToV2(): Promise<void> {
    console.log('Rolling back from v3 to v2');
    // Remove new fields from user sessions (Dexie handles schema rollback automatically)
  }

  /**
   * Migrate from version 3 to 4: Add missing indexed fields and update schema to match Supabase
   */
  private async migrateV3ToV4(): Promise<void> {
    console.log('Starting migration from v3 to v4');

    // Transform contacts data to add missing fields
    await this.transformContactsData();

    // Transform groups data to add missing fields
    await this.transformGroupsData();

    // Transform activity logs data to add missing fields
    await this.transformActivityLogsData();

    // Transform assets data to add missing fields
    await this.transformAssetsData();

    // Transform quotas data to add missing fields
    await this.transformQuotasData();

    // Transform profiles data to add missing fields
    await this.transformProfilesData();

    // Transform payments data to add missing fields
    await this.transformPaymentsData();
  }

  /**
   * Rollback from version 4 to 3
   */
  private async rollbackV4ToV3(): Promise<void> {
    console.log('Rolling back from v4 to v3');
    // This would involve removing the added fields, but Dexie handles schema rollback automatically
  }

  /**
   * Transform contacts data to add missing fields
   */
  private async transformContactsData(): Promise<void> {
    console.log('Transforming contacts data');
    const contacts = await db.contacts.toArray();
    const updatePromises = contacts.map(contact => {
      try {
        // Add missing fields with default values
        const updatedContact: LocalContact = {
          ...contact,
          created_by: contact.created_by || contact.master_user_id,
          tags: contact.tags || [],
          notes: contact.notes || '',
          is_blocked: contact.is_blocked !== undefined ? contact.is_blocked : false,
          last_interaction: contact.last_interaction || '',
          _syncStatus: contact._syncStatus || 'pending',
          _lastModified: contact._lastModified || nowISO(),
          _version: contact._version || 1,
          _deleted: contact._deleted || false
        };

        // Validate the transformed data
        const validatedData = validateData(updatedContact, 'contact');
        if (validatedData) {
          return db.contacts.put(validatedData as LocalContact);
        } else {
          console.error('Validation failed for contact:', contact);
          return Promise.resolve();
        }
      } catch (error) {
        console.error('Error transforming contact:', contact, error);
        return Promise.resolve();
      }
    });

    await Promise.all(updatePromises);
  }

  /**
    * Transform groups data to add missing fields
    */
  private async transformGroupsData(): Promise<void> {
    console.log('Transforming groups data');
    const groups = await db.groups.toArray();
    const updatePromises = groups.map(group => {
      try {
        // Add missing fields with default values
        const updatedGroup: LocalGroup = {
          ...group,
          created_by: group.created_by || group.master_user_id,
          _syncStatus: group._syncStatus || 'pending',
          _lastModified: group._lastModified || nowISO(),
          _version: group._version || 1,
          _deleted: group._deleted || false
        };

        // Validate the transformed data
        const validatedData = validateData(updatedGroup, 'groups');
        if (validatedData) {
          return db.groups.put(validatedData as LocalGroup);
        } else {
          console.error('Validation failed for group:', group);
          return Promise.resolve();
        }
      } catch (error) {
        console.error('Error transforming group:', group, error);
        return Promise.resolve();
      }
    });

    await Promise.all(updatePromises);
  }

  /**
    * Transform activity logs data to add missing fields
    */
  private async transformActivityLogsData(): Promise<void> {
    console.log('Transforming activity logs data');
    const logs = await db.activityLogs.toArray();
    const updatePromises = logs.map(log => {
      try {
        // Add missing fields with default values
        const updatedLog: LocalActivityLog = {
          ...log,
          user_id: log.user_id || log.master_user_id,
          contact_group_id: log.contact_group_id || '',
          template_id: log.template_id || '',
          total_contacts: log.total_contacts || 0,
          success_count: log.success_count || 0,
          failed_count: log.failed_count || 0,
          delay_range: log.delay_range || 30,
          scheduled_for: log.scheduled_for || '',
          started_at: log.started_at || '',
          completed_at: log.completed_at || '',
          error_message: log.error_message || '',
          metadata: log.metadata || {},
          _syncStatus: log._syncStatus || 'pending',
          _lastModified: log._lastModified || nowISO(),
          _version: log._version || 1,
          _deleted: log._deleted || false
        };

        // Validate the transformed data
        const validatedData = validateData(updatedLog, 'activityLogs');
        if (validatedData) {
          return db.activityLogs.put(validatedData as LocalActivityLog);
        } else {
          console.error('Validation failed for activity log:', log);
          return Promise.resolve();
        }
      } catch (error) {
        console.error('Error transforming activity log:', log, error);
        return Promise.resolve();
      }
    });

    await Promise.all(updatePromises);
  }

  /**
    * Transform assets data to add missing fields
    */
  private async transformAssetsData(): Promise<void> {
    console.log('Transforming assets data');
    const assets = await db.assets.toArray();
    const updatePromises = assets.map(asset => {
      try {
        // Add missing fields with default values
        const updatedAsset: LocalAsset = {
          ...asset,
          file_name: asset.file_name || asset.name,
          uploaded_by: asset.uploaded_by || asset.master_user_id,
          mime_type: asset.mime_type || 'application/octet-stream',
          is_public: asset.is_public !== undefined ? asset.is_public : false,
          created_at: asset.created_at || nowISO(),
          updated_at: asset.updated_at || nowISO(),
          _syncStatus: asset._syncStatus || 'pending',
          _lastModified: asset._lastModified || nowISO(),
          _version: asset._version || 1,
          _deleted: asset._deleted || false
        };

        // Validate the transformed data
        const validatedData = validateData(updatedAsset, 'assets');
        if (validatedData) {
          return db.assets.put(validatedData as LocalAsset);
        } else {
          console.error('Validation failed for asset:', asset);
          return Promise.resolve();
        }
      } catch (error) {
        console.error('Error transforming asset:', asset, error);
        return Promise.resolve();
      }
    });

    await Promise.all(updatePromises);
  }

  /**
    * Transform quotas data to add missing fields
    */
  private async transformQuotasData(): Promise<void> {
    console.log('Transforming quotas data');
    const quotas = await db.quotas.toArray();
    const updatePromises = quotas.map(quota => {
      try {
        // Add missing fields with default values
        const updatedQuota: LocalQuota = {
          ...quota,
          messages_limit: quota.messages_limit || 100,
          messages_used: quota.messages_used || 0,
          reset_date: quota.reset_date || nowISO(),
          is_active: quota.is_active !== undefined ? quota.is_active : true,
          _syncStatus: quota._syncStatus || 'pending',
          _lastModified: quota._lastModified || nowISO(),
          _version: quota._version || 1
        };

        // Calculate remaining messages
        updatedQuota.remaining = updatedQuota.messages_limit - updatedQuota.messages_used;

        // Validate the transformed data
        const validatedData = validateData(updatedQuota, 'quotas');
        if (validatedData) {
          return db.quotas.put(validatedData as LocalQuota);
        } else {
          console.error('Validation failed for quota:', quota);
          return Promise.resolve();
        }
      } catch (error) {
        console.error('Error transforming quota:', quota, error);
        return Promise.resolve();
      }
    });

    await Promise.all(updatePromises);
  }

  /**
    * Transform profiles data to add missing fields
    */
  private async transformProfilesData(): Promise<void> {
    console.log('Transforming profiles data');
    const profiles = await db.profiles.toArray();
    const updatePromises = profiles.map(profile => {
      try {
        // Add missing fields with default values
        const updatedProfile: LocalProfile = {
          ...profile,
          phone_number: profile.phone_number || '',
          avatar_url: profile.avatar_url || '',
          is_active: profile.is_active !== undefined ? profile.is_active : true,
          created_at: profile.created_at || nowISO(),
          updated_at: profile.updated_at || nowISO(),
          _syncStatus: profile._syncStatus || 'pending',
          _lastModified: profile._lastModified || nowISO(),
          _version: profile._version || 1,
          _deleted: profile._deleted !== undefined ? profile._deleted : false
        };

        // Validate the transformed data
        const validatedData = validateData(updatedProfile, 'profiles');
        if (validatedData) {
          return db.profiles.put(validatedData as LocalProfile);
        } else {
          console.error('Validation failed for profile:', profile);
          return Promise.resolve();
        }
      } catch (error) {
        console.error('Error transforming profile:', profile, error);
        return Promise.resolve();
      }
    });

    await Promise.all(updatePromises);
  }

  /**
    * Transform payments data to add missing fields
    */
  private async transformPaymentsData(): Promise<void> {
    console.log('Transforming payments data');
    const payments = await db.payments.toArray();
    const updatePromises = payments.map(payment => {
      try {
        // Add missing fields with default values
        const updatedPayment: LocalPayment = {
          ...payment,
          duitku_transaction_id: payment.duitku_transaction_id || '',
          amount: payment.amount || 0,
          currency: payment.currency || 'IDR',
          payment_method: payment.payment_method || '',
          qr_url: payment.qr_url || '',
          payment_url: payment.payment_url || '',
          expires_at: payment.expires_at || '',
          completed_at: payment.completed_at || '',
          _syncStatus: payment._syncStatus || 'pending',
          _lastModified: payment._lastModified || nowISO(),
          _version: payment._version || 1,
          _deleted: payment._deleted !== undefined ? payment._deleted : false
        };

        // Validate the transformed data
        const validatedData = validateData(updatedPayment, 'payments');
        if (validatedData) {
          return db.payments.put(validatedData as LocalPayment);
        } else {
          console.error('Validation failed for payment:', payment);
          return Promise.resolve();
        }
      } catch (error) {
        console.error('Error transforming payment:', payment, error);
        return Promise.resolve();
      }
    });

    await Promise.all(updatePromises);
  }

  /**
    * Normalize timestamps in all records
    */
  async normalizeTimestamps(): Promise<void> {
    console.log('Normalizing timestamps across all tables');

    // Normalize contacts
    const contacts = await db.contacts.toArray();
    const normalizedContacts = contacts.map(contact => ({
      ...contact,
      created_at: normalizeTimestamp(contact.created_at),
      updated_at: normalizeTimestamp(contact.updated_at),
      last_interaction: contact.last_interaction ? normalizeTimestamp(contact.last_interaction) : contact.last_interaction
    }));
    await db.contacts.bulkPut(normalizedContacts);

    // Normalize groups
    const groups = await db.groups.toArray();
    const normalizedGroups = groups.map(group => ({
      ...group,
      created_at: normalizeTimestamp(group.created_at),
      updated_at: normalizeTimestamp(group.updated_at)
    }));
    await db.groups.bulkPut(normalizedGroups);

    // Normalize templates
    const templates = await db.templates.toArray();
    const normalizedTemplates = templates.map(template => ({
      ...template,
      created_at: normalizeTimestamp(template.created_at),
      updated_at: normalizeTimestamp(template.updated_at)
    }));
    await db.templates.bulkPut(normalizedTemplates);

    // Normalize activity logs
    const logs = await db.activityLogs.toArray();
    const normalizedLogs = logs.map(log => ({
      ...log,
      created_at: normalizeTimestamp(log.created_at),
      updated_at: normalizeTimestamp(log.updated_at),
      scheduled_for: log.scheduled_for ? normalizeTimestamp(log.scheduled_for) : log.scheduled_for,
      started_at: log.started_at ? normalizeTimestamp(log.started_at) : log.started_at,
      completed_at: log.completed_at ? normalizeTimestamp(log.completed_at) : log.completed_at
    }));
    await db.activityLogs.bulkPut(normalizedLogs);

    // Normalize assets
    const assets = await db.assets.toArray();
    const normalizedAssets = assets.map(asset => ({
      ...asset,
      created_at: normalizeTimestamp(asset.created_at),
      updated_at: normalizeTimestamp(asset.updated_at)
    }));
    await db.assets.bulkPut(normalizedAssets);

    // Normalize quotas
    const quotas = await db.quotas.toArray();
    const normalizedQuotas = quotas.map(quota => ({
      ...quota,
      created_at: normalizeTimestamp(quota.created_at),
      updated_at: normalizeTimestamp(quota.updated_at),
      reset_date: normalizeTimestamp(quota.reset_date)
    }));
    await db.quotas.bulkPut(normalizedQuotas);

    // Normalize profiles
    const profiles = await db.profiles.toArray();
    const normalizedProfiles = profiles.map(profile => ({
      ...profile,
      created_at: normalizeTimestamp(profile.created_at),
      updated_at: normalizeTimestamp(profile.updated_at)
    }));
    await db.profiles.bulkPut(normalizedProfiles);

    // Normalize payments
    const payments = await db.payments.toArray();
    const normalizedPayments = payments.map(payment => ({
      ...payment,
      created_at: normalizeTimestamp(payment.created_at),
      updated_at: normalizeTimestamp(payment.updated_at),
      expires_at: payment.expires_at ? normalizeTimestamp(payment.expires_at) : payment.expires_at,
      completed_at: payment.completed_at ? normalizeTimestamp(payment.completed_at) : payment.completed_at
    }));
    await db.payments.bulkPut(normalizedPayments);

    // Normalize user sessions
    const sessions = await db.userSessions.toArray();
    const normalizedSessions = sessions.map(session => ({
      ...session,
      created_at: normalizeTimestamp(session.created_at),
      last_active: normalizeTimestamp(session.last_active),
      expires_at: normalizeTimestamp(session.expires_at)
    }));
    await db.userSessions.bulkPut(normalizedSessions);

    // Normalize quota reservations
    const reservations = await db.quotaReservations.toArray();
    const normalizedReservations = reservations.map(reservation => ({
      ...reservation,
      created_at: normalizeTimestamp(reservation.created_at),
      updated_at: normalizeTimestamp(reservation.updated_at),
      expires_at: reservation.expires_at ? normalizeTimestamp(reservation.expires_at) : reservation.expires_at,
      committed_at: reservation.committed_at ? normalizeTimestamp(reservation.committed_at) : reservation.committed_at
    }));
    await db.quotaReservations.bulkPut(normalizedReservations);
  }

  /**
   * Perform a complete migration with rollback support
   */
  async migrateWithRollback(): Promise<void> {
    try {
      // Store original data for potential rollback
      const originalData = await this.backupCurrentData();

      // Perform migration
      await this.migrate();

      // Verify migration
      const isSuccessful = await this.verifyMigration();

      if (!isSuccessful) {
        console.error('Migration verification failed, attempting rollback');
        await this.rollback(originalData);
        throw new Error('Migration verification failed');
      }

      console.log('Migration completed successfully with verification');
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }

  /**
   * Rollback to previous state using backup data
   */
  private async rollback(backupData: any): Promise<void> {
    console.log('Starting rollback process');

    // Clear current data
    await db.transaction('rw', db.tables, async () => {
      await db.contacts.clear();
      await db.groups.clear();
      await db.templates.clear();
      await db.activityLogs.clear();
      await db.assets.clear();
      await db.quotas.clear();
      await db.quotaReservations.clear();
      await db.profiles.clear();
      await db.payments.clear();
      await db.userSessions.clear();
      await db.syncQueue.clear();
    });

    // Restore from backup
    await this.restoreFromBackup(backupData);

    console.log('Rollback completed');
  }

  /**
   * Backup current data before migration
   */
  private async backupCurrentData(): Promise<any> {
    console.log('Backing up current data');

    return {
      contacts: await db.contacts.toArray(),
      groups: await db.groups.toArray(),
      templates: await db.templates.toArray(),
      activityLogs: await db.activityLogs.toArray(),
      assets: await db.assets.toArray(),
      quotas: await db.quotas.toArray(),
      quotaReservations: await db.quotaReservations.toArray(),
      profiles: await db.profiles.toArray(),
      payments: await db.payments.toArray(),
      userSessions: await db.userSessions.toArray(),
      syncQueue: await db.syncQueue.toArray()
    };
  }

  /**
    * Restore data from backup
    */
  private async restoreFromBackup(backupData: any): Promise<void> {
    console.log('Restoring data from backup');

    await db.transaction('rw', db.tables, async () => {
      if (backupData.contacts) await db.contacts.bulkPut(backupData.contacts);
      if (backupData.groups) await db.groups.bulkPut(backupData.groups);
      if (backupData.templates) await db.templates.bulkPut(backupData.templates);
      if (backupData.activityLogs) await db.activityLogs.bulkPut(backupData.activityLogs);
      if (backupData.assets) await db.assets.bulkPut(backupData.assets);
      if (backupData.quotas) await db.quotas.bulkPut(backupData.quotas);
      if (backupData.quotaReservations) await db.quotaReservations.bulkPut(backupData.quotaReservations);
      if (backupData.profiles) await db.profiles.bulkPut(backupData.profiles);
      if (backupData.payments) await db.payments.bulkPut(backupData.payments);
      if (backupData.userSessions) await db.userSessions.bulkPut(backupData.userSessions);
      if (backupData.syncQueue) await db.syncQueue.bulkPut(backupData.syncQueue);
    });
  }

  /**
   * Verify migration by checking data integrity
   */
  private async verifyMigration(): Promise<boolean> {
    console.log('Verifying migration integrity');

    try {
      // Basic integrity checks
      const contacts = await db.contacts.toArray();
      const hasValidContacts = contacts.every(contact =>
        contact.id && contact.name && contact.phone && contact.master_user_id
      );

      const groups = await db.groups.toArray();
      const hasValidGroups = groups.every(group =>
        group.id && group.name && group.master_user_id
      );

      const templates = await db.templates.toArray();
      const hasValidTemplates = templates.every(template =>
        template.id && template.name && template.master_user_id
      );

      return hasValidContacts && hasValidGroups && hasValidTemplates;
    } catch (error) {
      console.error('Migration verification failed:', error);
      return false;
    }
  }
}
import { Template } from './types';
import { supabase, handleDatabaseError } from '../supabase';
import { db, LocalTemplate } from '../db';
import { SyncManager } from '../sync/SyncManager';
import { userContextManager } from '../security/UserContextManager';
import {
  toISOString,
  localToSupabase,
  addSyncMetadata,
  addTimestamps,
  standardizeForService
} from '../utils/timestamp';

export class TemplateService {
  private realtimeChannel: any = null;
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
      if (event.table === 'templates') {
        switch (event.type) {
          case 'sync_complete':
            console.log('Template sync completed');
            break;
          case 'sync_error':
            console.error('Template sync error:', event.error);
            break;
          case 'conflict_detected':
            console.warn('Template conflict detected:', event.message);
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
   * Background sync templates without blocking the main operation
   */
  private async backgroundSyncTemplates(): Promise<void> {
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
   * Transform local templates to match interface using standardized timestamps
   */
  private transformLocalTemplates(localTemplates: LocalTemplate[]): Template[] {
    return localTemplates.map(template => {
      // Use standardized timestamp transformation
      const standardized = standardizeForService(template, 'template');
      return {
        ...standardized,
        variants: template.variants || (template.content ? [template.content] : []),
        content: template.content,
        variables: template.variables || this.extractVariablesFromVariants(template.variants || [template.content || '']),
        category: template.category || 'general',
        is_active: template.is_active !== false,
        usage_count: template.usage_count || 0,
        assets: template.assets || []
      };
    });
  }

  /**
   * Get all templates for the current user
   * Prioritizes local data, falls back to server if needed
   * Enforces data isolation using UserContextManager
   * Enhanced with offline-first approach and better error handling
   */
  async getTemplates(): Promise<Template[]> {
    try {
      // Enforce data isolation - check user context
      const hasPermission = await userContextManager.canPerformAction('read_templates', 'templates');
      if (!hasPermission) {
        throw new Error('Access denied: insufficient permissions to read templates');
      }

      const masterUserId = await this.getMasterUserId();

      // Check online status and prioritize accordingly
      const isOnline = this.syncManager.getIsOnline();

      // First, try to get from local database
      let localTemplates = await db.templates
        .where('master_user_id')
        .equals(masterUserId)
        .and(template => !template._deleted)
        .toArray();

      // If we have local data, return it immediately (offline-first approach)
      if (localTemplates.length > 0) {
        const transformedTemplates = this.transformLocalTemplates(localTemplates);

        // If online, trigger background sync to update local data
        if (isOnline) {
          this.backgroundSyncTemplates().catch(console.warn);
        }

        return transformedTemplates;
      }

      // No local data available
      if (isOnline) {
        try {
          // Try to sync from server
          await this.syncManager.triggerSync();

          // Try local again after sync
          localTemplates = await db.templates
            .where('master_user_id')
            .equals(masterUserId)
            .and(template => !template._deleted)
            .toArray();

          if (localTemplates.length > 0) {
            return this.transformLocalTemplates(localTemplates);
          }
        } catch (syncError) {
          console.warn('Sync failed, trying direct server fetch:', syncError);
        }

        // Fallback to direct server fetch
        return await this.fetchTemplatesFromServer();
      } else {
        // Offline mode: return empty array or cached data
        console.log('Operating in offline mode - no templates available locally');
        return [];
      }
    } catch (error) {
      console.error('Error fetching templates:', error);

      // Enhanced error handling with offline fallback
      const isOnline = this.syncManager.getIsOnline();
      if (!isOnline) {
        // In offline mode, try to return whatever local data we have
        try {
          const masterUserId = await this.getMasterUserId();
          const localTemplates = await db.templates
            .where('master_user_id')
            .equals(masterUserId)
            .and(template => !template._deleted)
            .toArray();

          if (localTemplates.length > 0) {
            return this.transformLocalTemplates(localTemplates);
          }
        } catch (offlineError) {
          console.error('Even offline fallback failed:', offlineError);
        }

        return [];
      }

      // Online mode fallback to server
      try {
        return await this.fetchTemplatesFromServer();
      } catch (serverError) {
        console.error('Server fetch also failed:', serverError);
        throw new Error(`Failed to fetch templates: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Fetch templates directly from server
   */
  private async fetchTemplatesFromServer(): Promise<Template[]> {
    const user = await this.getCurrentUser();
    const masterUserId = await this.getMasterUserId();

    const { data, error } = await supabase
      .from('templates')
      .select(`
        id,
        name,
        variants,
        content,
        master_user_id,
        created_by,
        attachment_url,
        variables,
        category,
        is_active,
        usage_count,
        created_at,
        updated_at
      `)
      .eq('master_user_id', masterUserId)
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    // Transform data to match our interface with standardized timestamps
    return (data || []).map(template => {
      const standardized = standardizeForService(template, 'template');
      return {
        ...standardized,
        variants: template.variants || (template.content ? [template.content] : []),
        content: template.content,
        variables: template.variables || this.extractVariablesFromVariants(template.variants || [template.content || '']),
        category: template.category || 'general',
        is_active: template.is_active !== false,
        usage_count: template.usage_count || 0,
        assets: []
      };
    });
  }

  /**
   * Get a single template by ID
   */
  async getTemplateById(id: string): Promise<Template | null> {
    try {
      const masterUserId = await this.getMasterUserId();

      // Try local first
      const localTemplate = await db.templates.get(id);

      if (localTemplate && !localTemplate._deleted && localTemplate.master_user_id === masterUserId) {
        const transformed = this.transformLocalTemplates([localTemplate]);
        return transformed[0] || null;
      }

      // Fallback to server
      const { data, error } = await supabase
        .from('templates')
        .select(`
          id,
          name,
          variants,
          content,
          master_user_id,
          created_by,
          attachment_url,
          variables,
          category,
          is_active,
          usage_count,
          created_at,
          updated_at
        `)
        .eq('id', id)
        .eq('master_user_id', masterUserId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Template not found
        }
        throw error;
      }

      // Transform data with standardized timestamps
      const standardized = standardizeForService(data, 'template');
      return {
        ...standardized,
        variants: data.variants || (data.content ? [data.content] : []),
        content: data.content,
        variables: data.variables || this.extractVariablesFromVariants(data.variants || [data.content || '']),
        category: data.category || 'general',
        is_active: data.is_active !== false,
        usage_count: data.usage_count || 0,
        assets: []
      };
    } catch (error) {
      console.error('Error fetching template:', error);
      throw new Error(handleDatabaseError(error));
    }
  }

  /**
   * Create a new template - local first with sync
   * Enforces data isolation using UserContextManager
   */
  async createTemplate(templateData: Omit<Template, 'id' | 'created_at' | 'updated_at' | 'usage_count'>): Promise<Template> {
    try {
      // Enforce data isolation - check user context and permissions
      const hasPermission = await userContextManager.canPerformAction('create_templates', 'templates');
      if (!hasPermission) {
        throw new Error('Access denied: insufficient permissions to create templates');
      }

      const user = await this.getCurrentUser();
      const masterUserId = await this.getMasterUserId();

      // Validate minimum 3 variants
      if (!templateData.variants || templateData.variants.length < 3) {
        throw new Error('Template must have at least 3 variants');
      }

      // Filter out empty variants
      const validVariants = templateData.variants.filter(v => v.trim() !== '');
      if (validVariants.length < 3) {
        throw new Error('Template must have at least 3 non-empty variants');
      }

      // Extract variables from all variants
      const extractedVariables = this.extractVariablesFromVariants(validVariants);

      // Use standardized timestamp utilities
      const timestamps = addTimestamps({}, false);
      const syncMetadata = addSyncMetadata({}, false);

      // Prepare local template data
      const newLocalTemplate: Omit<LocalTemplate, 'id'> = {
        ...templateData,
        variants: validVariants,
        master_user_id: masterUserId,
        created_by: user.id,
        attachment_url: templateData.attachment_url,
        variables: extractedVariables,
        category: templateData.category || 'general',
        is_active: templateData.is_active !== false,
        usage_count: 0,
        created_at: timestamps.created_at,
        updated_at: timestamps.updated_at,
        _syncStatus: syncMetadata._syncStatus,
        _lastModified: syncMetadata._lastModified,
        _version: syncMetadata._version,
        _deleted: false
      };

      // Add to local database first
      const templateId = crypto.randomUUID();
      const localTemplate = {
        id: templateId,
        ...newLocalTemplate
      };

      await db.templates.add(localTemplate);

      // Transform for sync queue (convert Date objects to ISO strings)
      const syncData = localToSupabase(localTemplate);
      await this.syncManager.addToSyncQueue('templates', 'create', templateId, syncData);

      // Return transformed template
      return this.transformLocalTemplates([localTemplate])[0];
    } catch (error) {
      console.error('Error creating template:', error);
      throw new Error(handleDatabaseError(error));
    }
  }

  /**
   * Update an existing template - local first with sync
   * Enforces data isolation using UserContextManager
   */
  async updateTemplate(id: string, updates: Partial<Template>): Promise<Template> {
    try {
      // Enforce data isolation - check user context and permissions
      const hasPermission = await userContextManager.canPerformAction('update_templates', 'templates');
      if (!hasPermission) {
        throw new Error('Access denied: insufficient permissions to update templates');
      }

      const user = await this.getCurrentUser();
      const masterUserId = await this.getMasterUserId();

      // Check if template exists locally
      const existingTemplate = await db.templates.get(id);

      if (!existingTemplate || existingTemplate._deleted) {
        // Template doesn't exist locally, try server
        const serverTemplate = await this.getTemplateById(id);
        if (!serverTemplate) {
          throw new Error('Template not found');
        }
      }

      // Validate minimum 3 variants if variants are being updated
      if (updates.variants) {
        const validVariants = updates.variants.filter(v => v.trim() !== '');
        if (validVariants.length < 3) {
          throw new Error('Template must have at least 3 non-empty variants');
        }
        updates.variants = validVariants;
      }

      // Extract variables if variants are updated
      if (updates.variants) {
        updates.variables = this.extractVariablesFromVariants(updates.variants);
      }

      // Use standardized timestamp utilities for updates
      const timestamps = addTimestamps({}, true);
      const syncMetadata = addSyncMetadata(existingTemplate, true);

      // Prepare update data
      const updateData = {
        ...updates,
        updated_at: timestamps.updated_at,
        _syncStatus: syncMetadata._syncStatus,
        _lastModified: syncMetadata._lastModified,
        _version: syncMetadata._version
      };

      // Update local database
      await db.templates.update(id, updateData);

      // Get updated record for sync
      const updatedTemplate = await db.templates.get(id);
      if (updatedTemplate) {
        // Transform for sync queue (convert Date objects to ISO strings)
        const syncData = localToSupabase(updatedTemplate);
        await this.syncManager.addToSyncQueue('templates', 'update', id, syncData);

        // Return transformed template
        return this.transformLocalTemplates([updatedTemplate])[0];
      }

      throw new Error('Template update failed');
    } catch (error) {
      console.error('Error updating template:', error);
      throw new Error(handleDatabaseError(error));
    }
  }

  /**
   * Delete a template (soft delete by setting is_active to false) - local first with sync
   * Enforces data isolation using UserContextManager
   */
  async deleteTemplate(id: string): Promise<void> {
    try {
      // Enforce data isolation - check user context and permissions
      const hasPermission = await userContextManager.canPerformAction('delete_templates', 'templates');
      if (!hasPermission) {
        throw new Error('Access denied: insufficient permissions to delete templates');
      }

      const masterUserId = await this.getMasterUserId();

      // Check if template exists locally
      const existingTemplate = await db.templates.get(id);

      if (!existingTemplate || existingTemplate._deleted) {
        // Template doesn't exist locally, try server-side delete
        await this.deleteTemplateFromServer(id);
        return;
      }

      // Use standardized sync metadata for soft delete
      const syncMetadata = addSyncMetadata(existingTemplate, true);

      // Soft delete locally
      await db.templates.update(id, {
        is_active: false,
        updated_at: syncMetadata._lastModified, // Use the same timestamp for consistency
        _syncStatus: syncMetadata._syncStatus,
        _lastModified: syncMetadata._lastModified,
        _version: syncMetadata._version,
        _deleted: true
      });

      // Transform for sync queue (convert Date objects to ISO strings)
      const syncData = localToSupabase(existingTemplate);
      await this.syncManager.addToSyncQueue('templates', 'delete', id, syncData);
    } catch (error) {
      console.error('Error deleting template:', error);
      throw new Error(handleDatabaseError(error));
    }
  }

  /**
   * Delete template from server (fallback)
   */
  private async deleteTemplateFromServer(id: string): Promise<void> {
    const masterUserId = await this.getMasterUserId();

    const { error } = await supabase
      .from('templates')
      .update({
        is_active: false,
        updated_at: toISOString(new Date())
      })
      .eq('id', id)
      .eq('master_user_id', masterUserId);

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error('Template not found or access denied');
      }
      throw error;
    }
  }

  /**
   * Get random variant from template
   */
  getRandomVariant(template: Template): string {
    if (!template.variants || template.variants.length === 0) {
      return '';
    }

    const randomIndex = Math.floor(Math.random() * template.variants.length);
    return template.variants[randomIndex];
  }

  /**
   * Get random variant with no consecutive repetition
   */
  getRandomVariantNoRepeat(template: Template, lastVariantIndex?: number): { variant: string; index: number } {
    if (!template.variants || template.variants.length === 0) {
      return { variant: '', index: -1 };
    }

    // If only one variant, return it
    if (template.variants.length === 1) {
      return { variant: template.variants[0], index: 0 };
    }

    let randomIndex: number;

    // Ensure we don't get the same variant consecutively
    do {
      randomIndex = Math.floor(Math.random() * template.variants.length);
    } while (lastVariantIndex !== undefined && randomIndex === lastVariantIndex && template.variants.length > 1);

    return {
      variant: template.variants[randomIndex],
      index: randomIndex
    };
  }

  /**
   * Extract variables from all variants
   */
  extractVariablesFromVariants(variants: string[]): string[] {
    const allVariables = variants
      .flatMap(variant => this.extractVariables(variant))
      .filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates

    return allVariables;
  }

  /**
   * Extract variables from a single content string
   */
  private extractVariables(content: string): string[] {
    const regex = /\{([^}]+)\}/g;
    const matches = content.match(regex);
    return matches ? matches.map(match => match.slice(1, -1)) : [];
  }

  /**
   * Subscribe to real-time template updates
   */
  subscribeToTemplateUpdates(callback: (payload: any) => void) {
    this.realtimeChannel = supabase
      .channel('template-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'templates'
        },
        (payload) => {
          // Transform payload with standardized timestamps
          if (payload.new) {
            payload.new = standardizeForService(payload.new, 'template');
          }
          if (payload.old) {
            payload.old = standardizeForService(payload.old, 'template');
          }
          callback(payload);
        }
      )
      .subscribe();
  }

  /**
  /**
   * Clean up real-time subscription
   */
  destroy() {
    if (this.realtimeChannel) {
      supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
    this.syncManager.destroy();
  }

  /**
   * Force sync with server
   */
  async forceSync(): Promise<void> {
    await this.syncManager.triggerSync();
  }

  /**
   * Get sync status for templates
   */
  async getSyncStatus() {
    const localTemplates = await db.templates
      .where('master_user_id')
      .equals(await this.getMasterUserId())
      .and(template => !template._deleted)
      .toArray();

    const pending = localTemplates.filter(t => t._syncStatus === 'pending').length;
    const synced = localTemplates.filter(t => t._syncStatus === 'synced').length;
    const conflicts = localTemplates.filter(t => t._syncStatus === 'conflict').length;

    return {
      total: localTemplates.length,
      pending,
      synced,
      conflicts,
      syncManagerStatus: this.syncManager.getStatus()
    };
  }
}

// Create a singleton instance
export const templateService = new TemplateService();
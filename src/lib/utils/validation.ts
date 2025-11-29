/**
 * Comprehensive type validation utilities for transformation functions
 * Provides runtime type checking, data validation, and error handling
 * for consistent data integrity across all services.
 */

import { Contact, ContactGroup, Template, ActivityLog, AssetFile, Quota } from '../services/types';
import { LocalProfile, LocalQuotaReservation } from '../db';

/**
 * Type guard for validating UUID format
 */
export function isValidUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return typeof value === 'string' && uuidRegex.test(value);
}

/**
 * Type guard for validating phone number format
 */
export function isValidPhoneNumber(phone: string): boolean {
  // Basic validation for international phone numbers
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return typeof phone === 'string' && phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
}

/**
 * Type guard for validating email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === 'string' && emailRegex.test(email);
}

/**
 * Type guard for validating color format (hex color)
 */
export function isValidColor(color: string): boolean {
  const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  return typeof color === 'string' && colorRegex.test(color);
}

/**
 * Type guard for validating JSON objects
 */
export function isValidJSONObject(obj: any): obj is Record<string, any> {
  return obj !== null && typeof obj === 'object' && !Array.isArray(obj);
}

/**
 * Type guard for validating arrays
 */
export function isValidArray<T>(arr: any, validator?: (item: T) => boolean): arr is T[] {
  if (!Array.isArray(arr)) return false;
  if (!validator) return true;
  return arr.every(validator);
}

/**
 * Validate and sanitize string value
 */
export function sanitizeString(value: any, fieldName: string, maxLength?: number): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value !== 'string') {
    console.warn(`Field ${fieldName} is not a string, converting to string:`, value);
    value = String(value);
  }

  // Remove potential XSS characters
  value = value.replace(/[<>\"']/g, '');

  if (maxLength && value.length > maxLength) {
    console.warn(`Field ${fieldName} exceeds max length ${maxLength}, truncating`);
    value = value.substring(0, maxLength);
  }

  return value.trim();
}

/**
 * Validate and convert boolean value
 */
export function sanitizeBoolean(value: any, fieldName: string): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 'true' || value === '1' || value === 1) {
    return true;
  }

  if (value === 'false' || value === '0' || value === 0) {
    return false;
  }

  console.warn(`Field ${fieldName} is not a valid boolean, defaulting to false:`, value);
  return false;
}

/**
 * Validate and convert number value
 */
export function sanitizeNumber(value: any, fieldName: string, min?: number, max?: number): number {
  if (typeof value === 'number' && !isNaN(value)) {
    if (min !== undefined && value < min) {
      console.warn(`Field ${fieldName} below minimum ${min}, clamping:`, value);
      return min;
    }
    if (max !== undefined && value > max) {
      console.warn(`Field ${fieldName} above maximum ${max}, clamping:`, value);
      return max;
    }
    return value;
  }

  if (typeof value === 'string') {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      return sanitizeNumber(numValue, fieldName, min, max);
    }
  }

  console.warn(`Field ${fieldName} is not a valid number, defaulting to 0:`, value);
  return 0;
}

/**
 * Validate and convert array value
 */
export function sanitizeArray<T>(value: any, fieldName: string, validator?: (item: any) => item is T): T[] {
  if (!Array.isArray(value)) {
    console.warn(`Field ${fieldName} is not an array, defaulting to empty array:`, value);
    return [];
  }

  if (validator) {
    const filtered = value.filter(validator);
    if (filtered.length !== value.length) {
      console.warn(`Field ${fieldName} contains invalid items, filtered from ${value.length} to ${filtered.length}`);
    }
    return filtered;
  }

  return value;
}

/**
 * Validate contact data with comprehensive type checking
 */
export function validateContact(data: any): Contact | null {
  if (!isValidJSONObject(data)) {
    console.error('Contact data is not a valid object:', data);
    return null;
  }

  try {
    const validated: Contact = {
      id: isValidUUID(data.id) ? data.id : crypto.randomUUID(),
      name: sanitizeString(data.name, 'name', 255),
      phone: isValidPhoneNumber(data.phone) ? data.phone : '',
      group_id: isValidUUID(data.group_id) ? data.group_id : '',
      master_user_id: isValidUUID(data.master_user_id) ? data.master_user_id : '',
      created_by: isValidUUID(data.created_by) ? data.created_by : '',
      tags: sanitizeArray(data.tags, 'tags', (tag): tag is string => typeof tag === 'string'),
      notes: sanitizeString(data.notes, 'notes', 1000),
      is_blocked: sanitizeBoolean(data.is_blocked, 'is_blocked'),
      last_interaction: data.last_interaction ? String(data.last_interaction) : undefined,
      created_at: String(data.created_at),
      updated_at: String(data.updated_at)
    };

    return validated;
  } catch (error) {
    console.error('Error validating contact data:', error, data);
    return null;
  }
}

/**
 * Validate group data with comprehensive type checking
 */
export function validateGroup(data: any): ContactGroup | null {
  if (!isValidJSONObject(data)) {
    console.error('Group data is not a valid object:', data);
    return null;
  }

  try {
    const validated: ContactGroup = {
      id: isValidUUID(data.id) ? data.id : crypto.randomUUID(),
      name: sanitizeString(data.name, 'name', 255),
      description: data.description ? sanitizeString(data.description, 'description', 500) : undefined,
      color: isValidColor(data.color) ? data.color : '#3b82f6',
      master_user_id: data.master_user_id && isValidUUID(data.master_user_id) ? data.master_user_id : undefined,
      created_by: data.created_by && isValidUUID(data.created_by) ? data.created_by : undefined,
      contact_count: sanitizeNumber(data.contact_count, 'contact_count', 0),
      is_active: sanitizeBoolean(data.is_active, 'is_active'),
      created_at: String(data.created_at),
      updated_at: String(data.updated_at)
    };

    return validated;
  } catch (error) {
    console.error('Error validating group data:', error, data);
    return null;
  }
}

/**
 * Validate template data with comprehensive type checking
 */
export function validateTemplate(data: any): Template | null {
  if (!isValidJSONObject(data)) {
    console.error('Template data is not a valid object:', data);
    return null;
  }

  try {
    const validated: Template = {
      id: isValidUUID(data.id) ? data.id : crypto.randomUUID(),
      name: sanitizeString(data.name, 'name', 255),
      variants: sanitizeArray(data.variants, 'variants', (variant): variant is string => typeof variant === 'string'),
      content: data.content ? sanitizeString(data.content, 'content', 5000) : undefined,
      master_user_id: data.master_user_id && isValidUUID(data.master_user_id) ? data.master_user_id : undefined,
      created_by: data.created_by && isValidUUID(data.created_by) ? data.created_by : undefined,
      attachment_url: data.attachment_url ? sanitizeString(data.attachment_url, 'attachment_url', 1000) : undefined,
      variables: sanitizeArray(data.variables, 'variables', (variable): variable is string => typeof variable === 'string'),
      category: sanitizeString(data.category, 'category', 100) || 'general',
      is_active: sanitizeBoolean(data.is_active, 'is_active'),
      usage_count: sanitizeNumber(data.usage_count, 'usage_count', 0),
      created_at: String(data.created_at),
      updated_at: String(data.updated_at),
      assets: sanitizeArray(data.assets, 'assets')
    };

    return validated;
  } catch (error) {
    console.error('Error validating template data:', error, data);
    return null;
  }
}

/**
 * Validate activity log data with comprehensive type checking
 */
export function validateActivityLog(data: any): ActivityLog | null {
  if (!isValidJSONObject(data)) {
    console.error('Activity log data is not a valid object:', data);
    return null;
  }

  try {
    const validStatuses = ['pending', 'running', 'completed', 'failed'] as const;
    const status = validStatuses.includes(data.status) ? data.status : 'pending';

    const validated: ActivityLog = {
      id: isValidUUID(data.id) ? data.id : crypto.randomUUID(),
      user_id: isValidUUID(data.user_id) ? data.user_id : '',
      master_user_id: isValidUUID(data.master_user_id) ? data.master_user_id : '',
      contact_group_id: data.contact_group_id && isValidUUID(data.contact_group_id) ? data.contact_group_id : undefined,
      template_id: data.template_id && isValidUUID(data.template_id) ? data.template_id : undefined,
      template_name: data.template_name ? sanitizeString(data.template_name, 'template_name', 255) : undefined,
      total_contacts: sanitizeNumber(data.total_contacts, 'total_contacts', 0),
      success_count: sanitizeNumber(data.success_count, 'success_count', 0),
      failed_count: sanitizeNumber(data.failed_count, 'failed_count', 0),
      status,
      delay_range: sanitizeNumber(data.delay_range, 'delay_range', 0, 86400),
      scheduled_for: data.scheduled_for ? String(data.scheduled_for) : undefined,
      started_at: data.started_at ? String(data.started_at) : undefined,
      completed_at: data.completed_at ? String(data.completed_at) : undefined,
      error_message: data.error_message ? sanitizeString(data.error_message, 'error_message', 1000) : undefined,
      metadata: isValidJSONObject(data.metadata) ? data.metadata : undefined,
      created_at: String(data.created_at),
      updated_at: String(data.updated_at)
    };

    return validated;
  } catch (error) {
    console.error('Error validating activity log data:', error, data);
    return null;
  }
}

/**
 * Validate asset file data with comprehensive type checking
 */
export function validateAssetFile(data: any): AssetFile | null {
  if (!isValidJSONObject(data)) {
    console.error('Asset file data is not a valid object:', data);
    return null;
  }

  try {
    const validCategories = ['image', 'video', 'audio', 'document', 'other'] as const;
    const category = validCategories.includes(data.category) ? data.category : 'other';

    const validated: AssetFile = {
      id: isValidUUID(data.id) ? data.id : crypto.randomUUID(),
      name: sanitizeString(data.name || data.file_name, 'name', 255),
      file_name: sanitizeString(data.file_name || data.name, 'file_name', 255),
      file_size: sanitizeNumber(data.file_size || data.size, 'file_size', 0),
      file_type: sanitizeString(data.file_type || data.type, 'file_type', 100),
      file_url: sanitizeString(data.file_url || data.url, 'file_url', 1000),
      uploaded_by: isValidUUID(data.uploaded_by) ? data.uploaded_by : '',
      master_user_id: isValidUUID(data.master_user_id) ? data.master_user_id : '',
      category,
      mime_type: data.mime_type ? sanitizeString(data.mime_type, 'mime_type', 100) : undefined,
      is_public: sanitizeBoolean(data.is_public, 'is_public'),
      created_at: String(data.created_at || data.uploadDate || new Date().toISOString()),
      updated_at: String(data.updated_at || data.created_at || new Date().toISOString()),
      // Backward compatibility fields
      size: sanitizeNumber(data.size || data.file_size, 'size', 0),
      type: sanitizeString(data.type || data.file_type, 'type', 100),
      uploadDate: String(data.uploadDate || data.created_at || new Date().toISOString()),
      url: data.url || data.file_url
    };

    return validated;
  } catch (error) {
    console.error('Error validating asset file data:', error, data);
    return null;
  }
}

/**
 * Validate quota data with comprehensive type checking
 */
export function validateQuota(data: any): Quota | null {
  if (!isValidJSONObject(data)) {
    console.error('Quota data is not a valid object:', data);
    return null;
  }

  try {
    const validPlans = ['basic', 'premium', 'enterprise'] as const;
    const plan_type = validPlans.includes(data.plan_type) ? data.plan_type : 'basic';

    const validated: Quota = {
      id: isValidUUID(data.id) ? data.id : crypto.randomUUID(),
      user_id: isValidUUID(data.user_id) ? data.user_id : '',
      master_user_id: isValidUUID(data.master_user_id) ? data.master_user_id : '',
      plan_type,
      messages_limit: sanitizeNumber(data.messages_limit, 'messages_limit', 0),
      messages_used: sanitizeNumber(data.messages_used, 'messages_used', 0),
      remaining: sanitizeNumber(data.remaining, 'remaining', 0),
      reset_date: String(data.reset_date),
      is_active: sanitizeBoolean(data.is_active, 'is_active'),
      created_at: String(data.created_at),
      updated_at: String(data.updated_at)
    };

    return validated;
  } catch (error) {
    console.error('Error validating quota data:', error, data);
    return null;
  }
}

/**
 * Validate profile data with comprehensive type checking
 */
export function validateProfile(data: any): LocalProfile | null {
  if (!isValidJSONObject(data)) {
    console.error('Profile data is not a valid object:', data);
    return null;
  }

  try {
    const validRoles = ['owner', 'staff'] as const;
    const role = validRoles.includes(data.role) ? data.role : 'owner';

    const validated: LocalProfile = {
      id: isValidUUID(data.id) ? data.id : crypto.randomUUID(),
      email: isValidEmail(data.email) ? data.email : '',
      name: sanitizeString(data.name, 'name', 255),
      role,
      master_user_id: isValidUUID(data.master_user_id) ? data.master_user_id : '',
      phone_number: data.phone_number ? sanitizeString(data.phone_number, 'phone_number', 20) : undefined,
      avatar_url: data.avatar_url ? sanitizeString(data.avatar_url, 'avatar_url', 1000) : undefined,
      is_active: sanitizeBoolean(data.is_active, 'is_active'),
      created_at: String(data.created_at),
      updated_at: String(data.updated_at),
      _syncStatus: data._syncStatus === 'pending' || data._syncStatus === 'synced' || data._syncStatus === 'conflict' || data._syncStatus === 'error' ? data._syncStatus : 'pending',
      _lastModified: String(data._lastModified),
      _version: sanitizeNumber(data._version, '_version', 0),
      _deleted: sanitizeBoolean(data._deleted, '_deleted')
    };

    return validated;
  } catch (error) {
    console.error('Error validating profile data:', error, data);
    return null;
  }
}

/**
 * Validate quota reservation data with comprehensive type checking
 */
export function validateQuotaReservation(data: any): LocalQuotaReservation | null {
  if (!isValidJSONObject(data)) {
    console.error('Quota reservation data is not a valid object:', data);
    return null;
  }

  try {
    const validStatuses = ['pending', 'committed', 'cancelled', 'expired'] as const;
    const status = validStatuses.includes(data.status) ? data.status : 'pending';

    const validated: LocalQuotaReservation = {
      id: isValidUUID(data.id) ? data.id : crypto.randomUUID(),
      user_id: isValidUUID(data.user_id) ? data.user_id : '',
      master_user_id: isValidUUID(data.master_user_id) ? data.master_user_id : '',
      quota_id: data.quota_id && isValidUUID(data.quota_id) ? data.quota_id : undefined,
      amount: sanitizeNumber(data.amount, 'amount', 0),
      status,
      expires_at: data.expires_at ? String(data.expires_at) : undefined,
      committed_at: data.committed_at ? String(data.committed_at) : undefined,
      created_at: String(data.created_at),
      updated_at: String(data.updated_at),
      _syncStatus: data._syncStatus === 'pending' || data._syncStatus === 'synced' || data._syncStatus === 'conflict' || data._syncStatus === 'error' ? data._syncStatus : 'pending',
      _lastModified: String(data._lastModified),
      _version: sanitizeNumber(data._version, '_version', 0),
      _deleted: sanitizeBoolean(data._deleted, '_deleted')
    };

    return validated;
  } catch (error) {
    console.error('Error validating quota reservation data:', error, data);
    return null;
  }
}

/**
 * Generic data validation function that chooses the appropriate validator
 */
export function validateData<T>(data: any, type: 'contact' | 'group' | 'template' | 'activityLog' | 'assetFile' | 'quota' | 'profile' | 'quotaReservation' | string): T | null {
  switch (type) {
    case 'contact':
    case 'contacts':
      return validateContact(data) as T;
    case 'group':
    case 'groups':
      return validateGroup(data) as T;
    case 'template':
    case 'templates':
      return validateTemplate(data) as T;
    case 'activityLog':
    case 'activity_logs':
      return validateActivityLog(data) as T;
    case 'assetFile':
    case 'assets':
      return validateAssetFile(data) as T;
    case 'quota':
    case 'quotas':
      return validateQuota(data) as T;
    case 'profile':
    case 'profiles':
      return validateProfile(data) as T;
    case 'quotaReservation':
    case 'quotaReservations':
      return validateQuotaReservation(data) as T;
    default:
      console.error('Unknown data type for validation:', type);
      return null;
  }
}

/**
 * Log validation errors with context
 */
export function logValidationError(operation: string, dataType: string, originalData: any, error: any): void {
  console.error(`Validation failed for ${operation} ${dataType}:`, {
    error: error instanceof Error ? error.message : error,
    originalData: originalData,
    timestamp: new Date().toISOString()
  });
}

/**
 * Create a safe transformation wrapper that includes validation
 */
export function safeTransform<T>(
  transformFn: (data: any) => T,
  validator: (data: any) => T | null,
  data: any,
  operation: string,
  dataType: string
): T | null {
  try {
    // First validate the input data
    const validated = validator(data);
    if (!validated) {
      logValidationError(operation, dataType, data, 'Validation returned null');
      return null;
    }

    // Then apply the transformation
    const transformed = transformFn(validated);
    return transformed;
  } catch (error) {
    logValidationError(operation, dataType, data, error);
    return null;
  }
}
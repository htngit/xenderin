/**
 * LocalSecurityService - Centralized RLS (Row Level Security) Enforcement
 * Provides comprehensive access control and data isolation for the application
 */

import { userContextManager } from './UserContextManager';
import { User } from '../services/types';
import { SecurityEventType, UserContextValidation } from './UserContextManager';

export interface SecurityPolicy {
  resource: string;
  action: string;
  condition?: (user: User, context: any) => boolean;
  allowOwner?: boolean;
  allowStaff?: boolean;
}

export interface AccessControlResult {
  allowed: boolean;
  reason?: string;
  user?: User;
  resourceMasterUserId?: string;
}

/**
 * Security event interface for audit logging
 */
export interface SecurityEvent {
  id: string;
  event_type: SecurityEventType;
  user_id?: string;
  master_user_id?: string;
  resource?: string;
  action?: string;
  ip_address?: string;
  user_agent?: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  details?: Record<string, any>;
  _syncStatus: 'pending' | 'synced' | 'error';
  _lastModified: string;
  _version: number;
  _deleted?: boolean;
}

/**
 * Centralized security service that enforces RLS-like policies
 * Manages permissions, data isolation, and security auditing
 */
export class LocalSecurityService {
  private static instance: LocalSecurityService;
  
  // Default security policies for different resources and actions
  private readonly securityPolicies: SecurityPolicy[] = [
    // Contacts
    { resource: 'contacts', action: 'read_contacts', allowOwner: true, allowStaff: true },
    { resource: 'contacts', action: 'create_contacts', allowOwner: true, allowStaff: true },
    { resource: 'contacts', action: 'update_contacts', allowOwner: true, allowStaff: true },
    { resource: 'contacts', action: 'delete_contacts', allowOwner: true, allowStaff: false },
    
    // Groups
    { resource: 'groups', action: 'read_groups', allowOwner: true, allowStaff: true },
    { resource: 'groups', action: 'create_groups', allowOwner: true, allowStaff: true },
    { resource: 'groups', action: 'update_groups', allowOwner: true, allowStaff: true },
    { resource: 'groups', action: 'delete_groups', allowOwner: true, allowStaff: false },
    
    // Templates
    { resource: 'templates', action: 'read_templates', allowOwner: true, allowStaff: true },
    { resource: 'templates', action: 'create_templates', allowOwner: true, allowStaff: true },
    { resource: 'templates', action: 'update_templates', allowOwner: true, allowStaff: true },
    { resource: 'templates', action: 'delete_templates', allowOwner: true, allowStaff: false },
    
    // Assets
    { resource: 'assets', action: 'read_assets', allowOwner: true, allowStaff: true },
    { resource: 'assets', action: 'upload_assets', allowOwner: true, allowStaff: true },
    { resource: 'assets', action: 'delete_assets', allowOwner: true, allowStaff: false },
    
    // History
    { resource: 'history', action: 'read_history', allowOwner: true, allowStaff: true },
    { resource: 'history', action: 'create_history', allowOwner: true, allowStaff: true },
    
    // Quotas
    { resource: 'quotas', action: 'read_quotas', allowOwner: true, allowStaff: true },
    { resource: 'quotas', action: 'manage_quotas', allowOwner: true, allowStaff: false },
    
    // Payments
    { resource: 'payments', action: 'read_payments', allowOwner: true, allowStaff: true },
    { resource: 'payments', action: 'create_payments', allowOwner: true, allowStaff: true },
    { resource: 'payments', action: 'manage_payments', allowOwner: true, allowStaff: false },
    
    // Admin functions
    { resource: 'admin', action: 'view_audit_logs', allowOwner: true, allowStaff: false },
    { resource: 'admin', action: 'manage_users', allowOwner: true, allowStaff: false },
    { resource: 'admin', action: 'manage_subscription', allowOwner: true, allowStaff: false },
  ];

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): LocalSecurityService {
    if (!LocalSecurityService.instance) {
      LocalSecurityService.instance = new LocalSecurityService();
    }
    return LocalSecurityService.instance;
  }

  /**
   * Check if current user can perform an action on a resource
   */
  async checkPermission(action: string, resource: string, resourceMasterUserId?: string): Promise<AccessControlResult> {
    try {
      const user = await userContextManager.getCurrentUser();
      
      if (!user) {
        return {
          allowed: false,
          reason: 'User not authenticated',
          user: undefined,
          resourceMasterUserId
        };
      }

      // Find matching policy
      const policy = this.findPolicy(resource, action);
      if (!policy) {
        return {
          allowed: false,
          reason: `No policy defined for resource: ${resource}, action: ${action}`,
          user,
          resourceMasterUserId
        };
      }

      // Check role-based permissions
      if (!this.hasRolePermission(user, policy)) {
        return {
          allowed: false,
          reason: `Insufficient permissions for role: ${user.role}`,
          user,
          resourceMasterUserId
        };
      }

      // Check custom conditions if defined
      if (policy.condition && !policy.condition(user, { resourceMasterUserId })) {
        return {
          allowed: false,
          reason: 'Custom policy condition not met',
          user,
          resourceMasterUserId
        };
      }

      // Check data isolation if resource master user ID is provided
      if (resourceMasterUserId) {
        const dataIsolationAllowed = await userContextManager.enforceDataIsolation(
          resourceMasterUserId,
          resource
        );
        
        if (!dataIsolationAllowed) {
          return {
            allowed: false,
            reason: 'Data isolation violation: cross-tenant access denied',
            user,
            resourceMasterUserId
          };
        }
      }

      return {
        allowed: true,
        reason: 'Permission granted',
        user,
        resourceMasterUserId
      };

    } catch (error) {
      console.error('Security check error:', error);
      return {
        allowed: false,
        reason: `Security check failed: ${error instanceof Error ? error.message : String(error)}`,
        resourceMasterUserId
      };
    }
  }

  /**
   * Enforce permission check and throw error if denied
   */
  async enforcePermission(action: string, resource: string, resourceMasterUserId?: string): Promise<void> {
    const result = await this.checkPermission(action, resource, resourceMasterUserId);
    
    if (!result.allowed) {
      throw new Error(`Access denied: ${result.reason}`);
    }
  }

  /**
   * Check if user can access a specific record (by ID)
   */
  async canAccessRecord(
    action: string,
    resource: string,
    recordMasterUserId: string
  ): Promise<AccessControlResult> {
    return await this.checkPermission(action, resource, recordMasterUserId);
  }

  /**
   * Validate user context and return validation result
   */
  async validateUserContext(user: User): Promise<UserContextValidation> {
    return await userContextManager.validateUserContext(user);
  }

  /**
   * Check if current user has sufficient privileges
   */
  async hasPrivilege(requiredRole: 'owner' | 'staff', resource?: string, action?: string): Promise<boolean> {
    const user = await userContextManager.getCurrentUser();
    
    if (!user) return false;
    
    // Owner has all privileges
    if (user.role === 'owner') return true;
    
    // Check role requirement
    if (requiredRole === 'owner') return false;
    if (requiredRole === 'staff' && user.role === 'staff') {
      // If specific resource/action is requested, check policy
      if (resource && action) {
        const policy = this.findPolicy(resource, action);
        return policy?.allowStaff === true;
      }
      return true;
    }
    
    return false;
  }

  /**
   * Get security audit trail
   */
  async getSecurityAuditTrail(limit: number = 100): Promise<SecurityEvent[]> {
    return await userContextManager.getSecurityAuditTrail(limit);
  }

  /**
   * Log a custom security event
   */
  async logSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp' | '_syncStatus' | '_lastModified' | '_version' | '_deleted'>): Promise<void> {
    await userContextManager['logSecurityEvent'](event);
  }

  /**
   * Check data isolation for cross-tenant access
   */
  async enforceDataIsolation(resourceMasterUserId: string, resourceType: string): Promise<boolean> {
    return await userContextManager.enforceDataIsolation(resourceMasterUserId, resourceType);
  }

  /**
   * Add or update a security policy
   */
  addSecurityPolicy(policy: SecurityPolicy): void {
    const existingIndex = this.securityPolicies.findIndex(
      p => p.resource === policy.resource && p.action === policy.action
    );
    
    if (existingIndex >= 0) {
      this.securityPolicies[existingIndex] = policy;
    } else {
      this.securityPolicies.push(policy);
    }
  }

  /**
   * Remove a security policy
   */
  removeSecurityPolicy(resource: string, action: string): void {
    const index = this.securityPolicies.findIndex(
      p => p.resource === resource && p.action === action
    );
    
    if (index >= 0) {
      this.securityPolicies.splice(index, 1);
    }
  }

  /**
   * Get all security policies
   */
  getSecurityPolicies(): SecurityPolicy[] {
    return [...this.securityPolicies];
  }

  /**
   * Find a specific policy
   */
  private findPolicy(resource: string, action: string): SecurityPolicy | undefined {
    return this.securityPolicies.find(
      p => p.resource === resource && p.action === action
    );
  }

  /**
   * Check if user has role-based permission for a policy
   */
  private hasRolePermission(user: User, policy: SecurityPolicy): boolean {
    if (user.role === 'owner' && policy.allowOwner) return true;
    if (user.role === 'staff' && policy.allowStaff) return true;
    return false;
  }

  /**
   * Get current user with security context
   */
  async getCurrentUser(): Promise<User | null> {
    return await userContextManager.getCurrentUser();
  }

  /**
   * Get current master user ID
   */
  async getCurrentMasterUserId(): Promise<string | null> {
    return await userContextManager.getCurrentMasterUserId();
  }

  /**
   * Validate and sanitize input data for security
   */
  validateAndSanitizeInput(data: any, allowedFields: string[]): any {
    if (!data || typeof data !== 'object') return null;
    
    const sanitized: any = {};
    
    for (const field of allowedFields) {
      if (field in data) {
        sanitized[field] = data[field];
      }
    }
    
    return sanitized;
  }

  /**
   * Rate limiting check (basic implementation)
   */
  private rateLimits = new Map<string, { count: number; resetTime: number }>();
  
  async checkRateLimit(identifier: string, limit: number = 100, windowMs: number = 60000): Promise<boolean> {
    const now = Date.now();
    const current = this.rateLimits.get(identifier);
    
    if (!current || now > current.resetTime) {
      this.rateLimits.set(identifier, { count: 1, resetTime: now + windowMs });
      return true;
    }
    
    if (current.count >= limit) {
      return false;
    }
    
    current.count++;
    return true;
  }

  /**
   * Clean up expired rate limits
   */
  cleanupRateLimits(): void {
    const now = Date.now();
    for (const [key, value] of this.rateLimits.entries()) {
      if (now > value.resetTime) {
        this.rateLimits.delete(key);
      }
    }
  }
}

// Export singleton instance
export const localSecurityService = LocalSecurityService.getInstance();
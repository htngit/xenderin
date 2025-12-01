/**
 * Security Test Suite for Local RLS (Row Level Security) Implementation
 * Tests access control, data isolation, and permission enforcement
 */

import { localSecurityService } from './LocalSecurityService';
import { userContextManager } from './UserContextManager';
import { User } from '../services/types';

export interface SecurityTestResult {
  testName: string;
  passed: boolean;
  message?: string;
  error?: string;
}

export interface SecurityTestSuite {
  suiteName: string;
  tests: SecurityTestResult[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
  success: boolean;
}

/**
 * Comprehensive security testing for RLS implementation
 */
export class SecurityTestRunner {

  /**
   * Run all security tests
   */
  async runAllTests(): Promise<SecurityTestSuite[]> {
    console.log('🛡️ Starting Local RLS Security Tests...');

    const testSuites: SecurityTestSuite[] = [];

    // Test 1: Permission System Tests
    testSuites.push(await this.testPermissionSystem());

    // Test 2: Data Isolation Tests
    testSuites.push(await this.testDataIsolation());

    // Test 3: User Context Tests
    testSuites.push(await this.testUserContext());

    // Test 4: Security Policies Tests
    testSuites.push(await this.testSecurityPolicies());

    // Test 5: Rate Limiting Tests
    testSuites.push(await this.testRateLimiting());

    // Test 6: Audit Logging Tests
    testSuites.push(await this.testAuditLogging());

    // Print results
    this.printTestResults(testSuites);

    return testSuites;
  }

  /**
   * Test permission system functionality
   */
  private async testPermissionSystem(): Promise<SecurityTestSuite> {
    console.log('🔐 Testing Permission System...');

    const tests: SecurityTestResult[] = [];

    try {
      // Test 1: Check permission for non-authenticated user
      const noAuthResult = await localSecurityService.checkPermission('read_contacts', 'contacts');
      tests.push({
        testName: 'Non-authenticated user should be denied',
        passed: !noAuthResult.allowed,
        message: noAuthResult.reason
      });

      // Test 2: Verify all security policies are loaded
      const policies = localSecurityService.getSecurityPolicies();
      tests.push({
        testName: 'Security policies should be loaded',
        passed: policies.length > 0,
        message: `Loaded ${policies.length} policies`
      });

      // Test 3: Test role-based permissions
      const ownerTestUser: User = {
        id: 'test-owner-id',
        email: 'owner@test.com',
        name: 'Test Owner',
        role: 'owner',
        master_user_id: 'test-master-id',
        created_at: new Date().toISOString()
      };

      const staffTestUser: User = {
        id: 'test-staff-id',
        email: 'staff@test.com',
        name: 'Test Staff',
        role: 'staff',
        master_user_id: 'test-master-id',
        created_at: new Date().toISOString()
      };

      // Test owner permissions (should have access to admin functions)
      await userContextManager.setCurrentUser(ownerTestUser);
      const ownerAdminAccess = await localSecurityService.checkPermission('view_audit_logs', 'admin');
      tests.push({
        testName: 'Owner should have admin access',
        passed: ownerAdminAccess.allowed,
        message: ownerAdminAccess.reason
      });

      // Test staff permissions (should not have access to admin functions)
      await userContextManager.setCurrentUser(staffTestUser);
      const staffAdminAccess = await localSecurityService.checkPermission('view_audit_logs', 'admin');
      tests.push({
        testName: 'Staff should not have admin access',
        passed: !staffAdminAccess.allowed,
        message: staffAdminAccess.reason
      });

    } catch (error) {
      tests.push({
        testName: 'Permission system test execution',
        passed: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return this.createTestSuite('Permission System', tests);
  }

  /**
   * Test data isolation between different tenants
   */
  private async testDataIsolation(): Promise<SecurityTestSuite> {
    console.log('🔒 Testing Data Isolation...');

    const tests: SecurityTestResult[] = [];

    try {
      // Setup test users from different tenants
      const tenant1User: User = {
        id: 'tenant1-user-id',
        email: 'user1@tenant1.com',
        name: 'Tenant 1 User',
        role: 'owner',
        master_user_id: 'tenant1-master-id',
        created_at: new Date().toISOString()
      };

      const tenant2User: User = {
        id: 'tenant2-user-id',
        email: 'user2@tenant2.com',
        name: 'Tenant 2 User',
        role: 'owner',
        master_user_id: 'tenant2-master-id',
        created_at: new Date().toISOString()
      };

      // Test cross-tenant access should be denied
      await userContextManager.setCurrentUser(tenant1User);

      // Try to access data from tenant2 (should fail)
      const crossTenantAccess = await localSecurityService.checkPermission(
        'read_contacts',
        'contacts',
        tenant2User.master_user_id
      );

      tests.push({
        testName: 'Cross-tenant access should be denied',
        passed: !crossTenantAccess.allowed,
        message: crossTenantAccess.reason
      });

      // Test same-tenant access should be allowed
      const sameTenantAccess = await localSecurityService.checkPermission(
        'read_contacts',
        'contacts',
        'tenant1-master-id'
      );

      tests.push({
        testName: 'Same-tenant access should be allowed',
        passed: sameTenantAccess.allowed,
        message: sameTenantAccess.reason
      });

      // Test with staff user from same tenant
      const staffUser: User = {
        id: 'tenant1-staff-id',
        email: 'staff@tenant1.com',
        name: 'Tenant 1 Staff',
        role: 'staff',
        master_user_id: 'tenant1-master-id',
        created_at: new Date().toISOString()
      };

      await userContextManager.setCurrentUser(staffUser);

      const staffSameTenantAccess = await localSecurityService.checkPermission(
        'read_contacts',
        'contacts',
        'tenant1-master-id'
      );

      tests.push({
        testName: 'Staff user should access same-tenant data',
        passed: staffSameTenantAccess.allowed,
        message: staffSameTenantAccess.reason
      });

    } catch (error) {
      tests.push({
        testName: 'Data isolation test execution',
        passed: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return this.createTestSuite('Data Isolation', tests);
  }

  /**
   * Test user context validation
   */
  private async testUserContext(): Promise<SecurityTestSuite> {
    console.log('👤 Testing User Context...');

    const tests: SecurityTestResult[] = [];

    try {
      // Test invalid user data
      const invalidUser = {
        id: 'invalid-id',
        email: 'invalid@test.com',
        name: 'Invalid User'
        // Missing required fields
      };

      try {
        await userContextManager.setCurrentUser(invalidUser as User);
        tests.push({
          testName: 'Invalid user should be rejected',
          passed: false,
          message: 'Should have thrown error for invalid user'
        });
      } catch (error) {
        tests.push({
          testName: 'Invalid user should be rejected',
          passed: true,
          message: 'Correctly rejected invalid user'
        });
      }

      // Test valid user context
      const validUser: User = {
        id: 'valid-user-id',
        email: 'valid@test.com',
        name: 'Valid User',
        role: 'owner',
        master_user_id: 'valid-master-id',
        created_at: new Date().toISOString()
      };

      await userContextManager.setCurrentUser(validUser);

      const currentUser = await userContextManager.getCurrentUser();
      tests.push({
        testName: 'Valid user context should be set',
        passed: currentUser !== null,
        message: currentUser ? `User: ${currentUser.email}` : 'No user returned'
      });

      // Test context cleanup
      await userContextManager.clearCurrentUser();
      const clearedUser = await userContextManager.getCurrentUser();
      tests.push({
        testName: 'User context should be cleared',
        passed: clearedUser === null,
        message: clearedUser ? 'User still exists' : 'Context cleared successfully'
      });

    } catch (error) {
      tests.push({
        testName: 'User context test execution',
        passed: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return this.createTestSuite('User Context', tests);
  }

  /**
   * Test security policy management
   */
  private async testSecurityPolicies(): Promise<SecurityTestSuite> {
    console.log('📋 Testing Security Policies...');

    const tests: SecurityTestResult[] = [];

    try {
      // Test policy retrieval
      const policies = localSecurityService.getSecurityPolicies();
      tests.push({
        testName: 'Should retrieve all policies',
        passed: policies.length > 0,
        message: `Retrieved ${policies.length} policies`
      });

      // Test custom policy addition
      const customPolicy = {
        resource: 'test_resource',
        action: 'test_action',
        allowOwner: true,
        allowStaff: false
      };

      const initialCount = localSecurityService.getSecurityPolicies().length;
      localSecurityService.addSecurityPolicy(customPolicy);
      const afterAddCount = localSecurityService.getSecurityPolicies().length;

      tests.push({
        testName: 'Should add custom policy',
        passed: afterAddCount === initialCount + 1,
        message: `Policies count: ${initialCount} -> ${afterAddCount}`
      });

      // Test policy update
      const updatedPolicy = {
        ...customPolicy,
        allowOwner: false
      };

      localSecurityService.addSecurityPolicy(updatedPolicy);
      const finalCount = localSecurityService.getSecurityPolicies().length;

      tests.push({
        testName: 'Should update existing policy',
        passed: finalCount === afterAddCount,
        message: `Policies count unchanged: ${finalCount}`
      });

      // Test policy removal
      localSecurityService.removeSecurityPolicy('test_resource', 'test_action');
      const afterRemoveCount = localSecurityService.getSecurityPolicies().length;

      tests.push({
        testName: 'Should remove policy',
        passed: afterRemoveCount === initialCount,
        message: `Policies count: ${afterRemoveCount} -> ${initialCount}`
      });

    } catch (error) {
      tests.push({
        testName: 'Security policies test execution',
        passed: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return this.createTestSuite('Security Policies', tests);
  }

  /**
   * Test rate limiting functionality
   */
  private async testRateLimiting(): Promise<SecurityTestSuite> {
    console.log('⏱️ Testing Rate Limiting...');

    const tests: SecurityTestResult[] = [];

    try {
      const testIdentifier = 'test-user-123';
      const limit = 3;
      const windowMs = 60000; // 1 minute

      // Test initial requests (should be allowed)
      let allowed = true;
      for (let i = 0; i < limit; i++) {
        const result = await localSecurityService.checkRateLimit(testIdentifier, limit, windowMs);
        if (!result) {
          allowed = false;
          break;
        }
      }

      tests.push({
        testName: 'Should allow requests within limit',
        passed: allowed,
        message: `All ${limit} requests allowed within limit`
      });

      // Test request exceeding limit
      const exceeded = await localSecurityService.checkRateLimit(testIdentifier, limit, windowMs);
      tests.push({
        testName: 'Should deny request exceeding limit',
        passed: !exceeded,
        message: exceeded ? 'Request allowed unexpectedly' : 'Request correctly denied'
      });

      // Test cleanup
      localSecurityService.cleanupRateLimits();
      tests.push({
        testName: 'Rate limit cleanup should execute',
        passed: true,
        message: 'Cleanup completed without error'
      });

    } catch (error) {
      tests.push({
        testName: 'Rate limiting test execution',
        passed: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return this.createTestSuite('Rate Limiting', tests);
  }

  /**
   * Test audit logging functionality
   */
  private async testAuditLogging(): Promise<SecurityTestSuite> {
    console.log('📊 Testing Audit Logging...');

    const tests: SecurityTestResult[] = [];

    try {
      // Test security event logging
      await localSecurityService.logSecurityEvent({
        event_type: 'permission_denied',
        user_id: 'test-user',
        master_user_id: 'test-master',
        resource: 'contacts',
        action: 'delete',
        severity: 'warning',
        details: { test: true }
      });

      tests.push({
        testName: 'Should log security events',
        passed: true,
        message: 'Security event logged successfully'
      });

      // Test audit trail retrieval
      const auditTrail = await localSecurityService.getSecurityAuditTrail(10);
      tests.push({
        testName: 'Should retrieve audit trail',
        passed: Array.isArray(auditTrail),
        message: `Retrieved ${auditTrail.length} audit entries`
      });

    } catch (error) {
      tests.push({
        testName: 'Audit logging test execution',
        passed: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return this.createTestSuite('Audit Logging', tests);
  }

  /**
   * Create test suite result
   */
  private createTestSuite(name: string, tests: SecurityTestResult[]): SecurityTestSuite {
    const passedTests = tests.filter(test => test.passed).length;
    const failedTests = tests.length - passedTests;

    return {
      suiteName: name,
      tests,
      totalTests: tests.length,
      passedTests,
      failedTests,
      success: failedTests === 0
    };
  }

  /**
   * Print test results to console
   */
  private printTestResults(testSuites: SecurityTestSuite[]): void {
    console.log('\n🛡️ Security Test Results Summary\n');

    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;

    testSuites.forEach(suite => {
      const status = suite.success ? '✅' : '❌';
      console.log(`${status} ${suite.suiteName} (${suite.passedTests}/${suite.totalTests})`);

      suite.tests.forEach(test => {
        const testStatus = test.passed ? '  ✅' : '  ❌';
        console.log(`${testStatus} ${test.testName}`);
        if (!test.passed && test.error) {
          console.log(`     Error: ${test.error}`);
        } else if (!test.passed && test.message) {
          console.log(`     Message: ${test.message}`);
        }
      });

      console.log('');

      totalTests += suite.totalTests;
      totalPassed += suite.passedTests;
      totalFailed += suite.failedTests;
    });

    const overallStatus = totalFailed === 0 ? '✅' : '❌';
    console.log(`${overallStatus} Overall Results: ${totalPassed}/${totalTests} tests passed`);

    if (totalFailed === 0) {
      console.log('🎉 All security tests passed! Local RLS implementation is working correctly.');
    } else {
      console.log(`⚠️  ${totalFailed} tests failed. Please review the security implementation.`);
    }
  }

  /**
   * Generate security report
   */
  async generateSecurityReport(): Promise<string> {
    const testSuites = await this.runAllTests();

    const report = {
      timestamp: new Date().toISOString(),
      overallStatus: testSuites.every(suite => suite.success) ? 'PASS' : 'FAIL',
      totalTests: testSuites.reduce((sum, suite) => sum + suite.totalTests, 0),
      passedTests: testSuites.reduce((sum, suite) => sum + suite.passedTests, 0),
      failedTests: testSuites.reduce((sum, suite) => sum + suite.failedTests, 0),
      testSuites: testSuites.map(suite => ({
        name: suite.suiteName,
        status: suite.success ? 'PASS' : 'FAIL',
        tests: suite.tests
      })),
      securityPolicies: localSecurityService.getSecurityPolicies(),
      recommendations: this.generateRecommendations(testSuites)
    };

    return JSON.stringify(report, null, 2);
  }

  /**
   * Generate security recommendations based on test results
   */
  private generateRecommendations(testSuites: SecurityTestSuite[]): string[] {
    const recommendations: string[] = [];

    const failedTests = testSuites.flatMap(suite =>
      suite.tests.filter(test => !test.passed)
    );

    if (failedTests.length === 0) {
      recommendations.push('All security tests passed. The Local RLS implementation is working correctly.');
      recommendations.push('Consider implementing additional rate limiting for API endpoints.');
      recommendations.push('Regular security audits should be performed to maintain security posture.');
    } else {
      recommendations.push('Security issues detected. Review and fix failed tests before production deployment.');
      recommendations.push('Implement additional monitoring for security events.');
      recommendations.push('Consider penetration testing to identify potential vulnerabilities.');
    }

    return recommendations;
  }
}

// Export test runner instance
export const securityTestRunner = new SecurityTestRunner();
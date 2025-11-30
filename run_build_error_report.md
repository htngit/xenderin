# Run Build Error Report

## Summary

The `npm run build` command failed due to multiple TypeScript errors in the project. Below is a comprehensive list of all the errors encountered during the build process.

## Error Details

### Component Files

1. **src/components/pages/ContactsPage.tsx**
   - `useCallback` is declared but never read
   - `LoadingScreen` is declared but never read
   - `Card` is declared but never read
   - `AlertDialogTrigger` is declared but never read
   - `Stagger` is declared but never read
   - `Filter` is declared but never read
   - `contacts` is declared but never read
   - `groups` is declared but never read

2. **src/components/pages/GroupPage.tsx**
   - `Card` is declared but never read
   - `AlertDialogTrigger` is declared but never read

3. **src/components/pages/LoginPage.tsx**
   - `serviceManager` is declared but never read

4. **src/components/pages/PINModal.tsx**
   - `Button` is declared but never read
   - `ChevronDown` is declared but never read

5. **src/components/pages/ResetPasswordPage.tsx**
   - `AuthService` is declared but never read
   - Comparison appears to be unintentional between types 'true' and 'false' (line 301)

6. **src/components/pages/SendPage.tsx**
   - `useRef` is declared but never read
   - All imports in import declaration are unused
   - `MessageLog` is declared but never read
   - `userName` is declared but never read
   - `selectedGroupData` is declared but never read
   - `targetContacts` is declared but never read

7. **src/components/pages/SubscriptionPage.tsx**
   - Multiple errors related to subscription plan types not being properly indexed
   - Element implicitly has an 'any' type because expression of type '"free" | "pro"' can't be used to index type
   - Element implicitly has an 'any' type because expression of type 'SubscriptionPlan' can't be used to index type

8. **src/components/settings/payment/PaymentMethodModal.tsx**
   - `React` is declared but never read

9. **src/components/settings/payment/PaymentTab.tsx**
   - Type 'string' is not assignable to type '"OL" | "DA" | "LQRIS" | "NQRIS" | "BC"'
   - Property 'duitku_payment_url' does not exist on type 'void'
   - Type with missing 'name' property is not assignable to expected type

10. **src/components/settings/team/TeamTab.tsx**
    - `Button` is declared but never read

11. **src/components/ui/calendar.tsx**
    - Cannot find module 'react-day-picker' or its type definitions
    - Parameter 'date' implicitly has an 'any' type
    - Binding elements 'className', 'rootRef', 'orientation', 'children' implicitly have 'any' types

12. **src/components/ui/ErrorScreen.tsx**
    - `React` is declared but never read

13. **src/components/ui/FilePreviewModal.tsx**
    - `X`, `FileImage`, `FileVideo` are declared but never read

14. **src/components/ui/InitialSyncScreen.tsx**
    - `Card` is declared but never read

15. **src/components/ui/LoadingScreen.tsx**
    - `React` is declared but never read

16. **src/components/ui/sonner.tsx**
    - Cannot find module 'next-themes' or its type definitions

17. **src/components/ui/UserSwitchDialog.tsx**
    - `previousUserId` is declared but never read

### Library Files

1. **src/lib/db.ts**
   - `primKey` and `trans` are declared but never read in multiple locations

2. **src/lib/db/dbCleanup.test.ts**
   - Cannot find module './db' or its type definitions
   - Cannot find names like 'describe', 'beforeAll', 'afterAll', 'test', 'expect'
   - Cannot find names 'jest' and 'beforeEach'

3. **src/lib/migrations/MigrationService.ts**
   - Multiple variables declared but never read: `Dexie`, `LocalTemplate`, `LocalQuotaReservation`, `transformUserSessionsData`, `contactsCount`, `groupsCount`, `templatesCount`

4. **src/lib/security/__tests__/DatabaseCleanup.test.ts**
   - Cannot find modules '../db' and '../security/UserContextManager'
   - Cannot find names 'jest', 'describe', 'beforeEach', 'afterEach', 'it', 'expect'

5. **src/lib/security/LocalSecurityService.ts**
   - `recordId` is declared but never read

6. **src/lib/security/SecurityTests.ts**
   - `tenant2User` is declared but never read

7. **src/lib/services/__tests__/QuotaService.test.ts**
   - Multiple variables declared but never read
   - Cannot find names like 'jest', 'describe', 'beforeEach', 'it', 'expect'
   - Property 'cancelQuotaReservation' does not exist on type

8. **src/lib/services/__tests__/ServiceInitializationManager.test.ts**
   - Cannot find names like 'jest', 'describe', 'beforeEach', 'it', 'expect'

9. **src/lib/services/AssetService.ts**
   - Type assignment error related to missing 'master_user_id' property
   - Variables `uploadData` and `nowISOTime` are declared but never read

10. **src/lib/services/ContactService.ts**
    - Variables `user` and `masterUserId` are declared but never read

11. **src/lib/services/GroupService.ts**
    - Variable `masterUserId` is declared but never read

12. **src/lib/services/HistoryService.ts**
    - Variable `masterUserId` is declared but never read

13. **src/lib/services/InitialSyncOrchestrator.ts**
    - Variable `masterUserId` is declared but never read

14. **src/lib/services/PaymentService.ts**
    - Variable `syncManager` is declared but never read

15. **src/lib/services/ServiceContext.tsx**
    - Cannot find names 'AuthService' and 'PaymentService'

16. **src/lib/services/TeamService.ts**
    - Module has no exported member 'LocalTeam' and 'Team'
    - Property 'teams' does not exist on type 'AppDatabase'
    - Parameter implicitly has an 'any' type

17. **src/lib/services/TemplateService.ts**
    - Variables `user` and `masterUserId` are declared but never read

### Root Cause Analysis

The build errors fall into several categories:

1. **Unused imports and variables**: The most common errors are for unused imports and variables declared but never used (TS6133)

2. **Missing type definitions**: Several modules cannot be found, such as 'react-day-picker', 'next-themes', and testing utilities (TS2307)

3. **Test-related errors**: The test files are missing jest type definitions and references to testing functions

4. **Type compatibility issues**: Some errors related to type mismatches and indexing issues

5. **Module property errors**: Some services are referencing properties that don't exist on the database schema

### Recommended Fixes

1. Remove all unused imports and variables throughout the codebase
2. Install missing dependencies like `@types/jest`, `react-day-picker`, and `next-themes`
3. Review and update the database schema to ensure all referenced properties exist
4. Fix type compatibility issues in SubscriptionPage and other affected files
5. Ensure all service types are properly defined and referenced
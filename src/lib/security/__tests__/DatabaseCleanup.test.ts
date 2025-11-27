import { db } from '../db';
import { userContextManager } from '../security/UserContextManager';

// Mock the necessary dependencies
jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      }))
    }))
  }
}));

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] || null
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock crypto for UUID generation
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9)
  },
  writable: true
});

describe('Database Cleanup Functionality Tests', () => {
  const testMasterUserId = 'test-master-user-id';
  const testAssetId = 'test-asset-id';
  
  beforeEach(async () => {
    // Clear all data before each test
    await db.clearAllData();
    localStorage.clear();
  });

  afterEach(async () => {
    // Clear all data after each test
    await db.clearAllData();
    localStorage.clear();
  });

  describe('User Tracking for Switch Detection', () => {
    it('should get and set last user ID correctly', () => {
      const userId = 'test-user-123';
      userContextManager.setLastUserId(userId);
      
      const lastUserId = userContextManager.getLastUserId();
      expect(lastUserId).toBe(userId);
    });

    it('should detect user change correctly', () => {
      // Initially no user has been set, so no change should be detected
      const noChangeDetected = userContextManager.hasUserChanged();
      expect(noChangeDetected).toBe(false);
      
      // Set a previous user
      userContextManager.setLastUserId('previous-user');
      
      // Set current user in the context manager (we'll mock this)
      (userContextManager as any).currentUser = { id: 'new-user', master_user_id: 'master-123' };
      
      // Should detect user change
      const hasChanged = userContextManager.hasUserChanged();
      expect(hasChanged).toBe(true);
    });

    it('should not detect user change when same user', () => {
      // Set a previous user
      userContextManager.setLastUserId('same-user');
      
      // Set current user to the same
      (userContextManager as any).currentUser = { id: 'same-user', master_user_id: 'master-123' };
      
      // Should not detect user change
      const hasChanged = userContextManager.hasUserChanged();
      expect(hasChanged).toBe(false);
    });
  });

  describe('Database Cleanup Logic', () => {
    it('should clear user data properly', async () => {
      // Add test data for the user
      await db.contacts.add({
        id: 'contact-1',
        name: 'Test Contact',
        phone: '1234567890',
        group_id: 'group-1',
        master_user_id: testMasterUserId,
        created_by: 'user-1',
        is_blocked: false,
        _syncStatus: 'synced',
        _lastModified: new Date().toISOString(),
        _version: 1,
        _deleted: false
      });

      await db.assets.add({
        id: testAssetId,
        name: 'Test Asset',
        file_name: 'test.jpg',
        file_size: 1000,
        file_type: 'image',
        file_url: 'https://example.com/test.jpg',
        master_user_id: testMasterUserId,
        uploaded_by: 'user-1',
        category: 'image',
        is_public: true,
        mime_type: 'image/jpeg',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        _syncStatus: 'synced',
        _lastModified: new Date().toISOString(),
        _version: 1,
        _deleted: false
      });

      // Add a cached asset blob
      await db.asset_blobs.add({
        asset_id: testAssetId,
        blob: new Blob(['test'], { type: 'text/plain' }) as any,
        mime_type: 'text/plain',
        size: 4,
        cached_at: new Date().toISOString(),
        last_accessed: new Date().toISOString(),
        _version: 1
      });

      // Verify data exists
      const contactsCount = await db.contacts.where('master_user_id').equals(testMasterUserId).count();
      const assetsCount = await db.assets.where('master_user_id').equals(testMasterUserId).count();
      const blobsCount = await db.asset_blobs.count();
      
      expect(contactsCount).toBe(1);
      expect(assetsCount).toBe(1);
      expect(blobsCount).toBe(1);

      // Clear user data
      await db.clearUserData(testMasterUserId);

      // Verify data is cleared
      const contactsAfter = await db.contacts.where('master_user_id').equals(testMasterUserId).count();
      const assetsAfter = await db.assets.where('master_user_id').equals(testMasterUserId).count();
      const blobsAfter = await db.asset_blobs.count();
      
      expect(contactsAfter).toBe(0);
      expect(assetsAfter).toBe(0);
      expect(blobsAfter).toBe(0);
    });

    it('should clear all data when clearAllData is called', async () => {
      // Add some test data
      await db.contacts.add({
        id: 'contact-1',
        name: 'Test Contact',
        phone: '1234567890',
        group_id: 'group-1',
        master_user_id: testMasterUserId,
        created_by: 'user-1',
        is_blocked: false,
        _syncStatus: 'synced',
        _lastModified: new Date().toISOString(),
        _version: 1,
        _deleted: false
      });

      await db.assets.add({
        id: 'asset-1',
        name: 'Test Asset',
        file_name: 'test.jpg',
        file_size: 1000,
        file_type: 'image',
        file_url: 'https://example.com/test.jpg',
        master_user_id: testMasterUserId,
        uploaded_by: 'user-1',
        category: 'image',
        is_public: true,
        mime_type: 'image/jpeg',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        _syncStatus: 'synced',
        _lastModified: new Date().toISOString(),
        _version: 1,
        _deleted: false
      });

      // Verify data exists
      const contactsCount = await db.contacts.count();
      const assetsCount = await db.assets.count();
      
      expect(contactsCount).toBeGreaterThan(0);
      expect(assetsCount).toBeGreaterThan(0);

      // Clear all data
      await db.clearAllData();

      // Verify all data is cleared
      const contactsAfter = await db.contacts.count();
      const assetsAfter = await db.assets.count();
      
      expect(contactsAfter).toBe(0);
      expect(assetsAfter).toBe(0);
    });

    it('should preserve data from other users during user-specific cleanup', async () => {
      const user1Id = 'user-1-master';
      const user2Id = 'user-2-master';

      // Add data for user 1
      await db.contacts.add({
        id: 'contact-1',
        name: 'User 1 Contact',
        phone: '1234567890',
        group_id: 'group-1',
        master_user_id: user1Id,
        created_by: 'user-1',
        is_blocked: false,
        _syncStatus: 'synced',
        _lastModified: new Date().toISOString(),
        _version: 1,
        _deleted: false
      });

      // Add data for user 2
      await db.contacts.add({
        id: 'contact-2',
        name: 'User 2 Contact',
        phone: '0987654321',
        group_id: 'group-2',
        master_user_id: user2Id,
        created_by: 'user-2',
        is_blocked: false,
        _syncStatus: 'synced',
        _lastModified: new Date().toISOString(),
        _version: 1,
        _deleted: false
      });

      // Verify both users' data exists
      const user1ContactsBefore = await db.contacts.where('master_user_id').equals(user1Id).count();
      const user2ContactsBefore = await db.contacts.where('master_user_id').equals(user2Id).count();
      
      expect(user1ContactsBefore).toBe(1);
      expect(user2ContactsBefore).toBe(1);

      // Clear data only for user 1
      await db.clearUserData(user1Id);

      // Verify user 1's data is gone but user 2's data remains
      const user1ContactsAfter = await db.contacts.where('master_user_id').equals(user1Id).count();
      const user2ContactsAfter = await db.contacts.where('master_user_id').equals(user2Id).count();
      
      expect(user1ContactsAfter).toBe(0);
      expect(user2ContactsAfter).toBe(1);
    });
  });
});
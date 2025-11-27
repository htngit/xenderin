import { db } from './db';

describe('Database Cleanup - User Data Isolation', () => {
  const testUserId1 = 'user-1-uuid';
  const testUserId2 = 'user-2-uuid';

  beforeAll(async () => {
    // Clear all data before tests
    await db.clearAllData();
  });

  afterAll(async () => {
    // Clean up after tests
    await db.clearAllData();
  });

  test('should properly isolate data between different users', async () => {
    // Create data for user 1
    const contact1 = {
      id: 'contact1',
      name: 'John Doe',
      phone: '+1234567890',
      master_user_id: testUserId1,
      created_by: testUserId1,
      group_id: 'group1',
      tags: ['tag1'],
      notes: 'Test contact',
      is_blocked: false,
      last_interaction: null,
      _syncStatus: 'synced' as const,
      _lastModified: new Date().toISOString(),
      _version: 1,
      _deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const asset1 = {
      id: 'asset1',
      name: 'Test Asset',
      file_name: 'test.jpg',
      file_size: 1024,
      file_type: 'image',
      file_url: 'https://example.com/test.jpg',
      uploaded_by: testUserId1,
      category: 'marketing' as const,
      mime_type: 'image/jpeg',
      is_public: false,
      master_user_id: testUserId1,
      _syncStatus: 'synced' as const,
      _lastModified: new Date().toISOString(),
      _version: 1,
      _deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Create blob for asset 1
    const blob = new Blob(['test'], { type: 'image/jpeg' });
    await db.asset_blobs.add({
      asset_id: 'asset1',
      blob,
      mime_type: 'image/jpeg',
      size: 4,
      cached_at: new Date().toISOString(),
      last_accessed: new Date().toISOString(),
      _version: 1
    });

    // Add data for user 1
    await db.contacts.add(contact1);
    await db.assets.add(asset1);

    // Create data for user 2
    const contact2 = {
      ...contact1,
      id: 'contact2',
      name: 'Jane Smith',
      master_user_id: testUserId2,
      created_by: testUserId2
    };

    const asset2 = {
      ...asset1,
      id: 'asset2',
      name: 'Test Asset 2',
      master_user_id: testUserId2,
      uploaded_by: testUserId2
    };

    // Create blob for asset 2
    await db.asset_blobs.add({
      asset_id: 'asset2',
      blob,
      mime_type: 'image/jpeg',
      size: 4,
      cached_at: new Date().toISOString(),
      last_accessed: new Date().toISOString(),
      _version: 1
    });

    // Add data for user 2
    await db.contacts.add(contact2);
    await db.assets.add(asset2);

    // Verify both users' data exists
    const user1Contacts = await db.contacts.where('master_user_id').equals(testUserId1).toArray();
    const user1Assets = await db.assets.where('master_user_id').equals(testUserId1).toArray();
    const user1Blobs = await db.asset_blobs.where('asset_id').equals('asset1').toArray();

    const user2Contacts = await db.contacts.where('master_user_id').equals(testUserId2).toArray();
    const user2Assets = await db.assets.where('master_user_id').equals(testUserId2).toArray();
    const user2Blobs = await db.asset_blobs.where('asset_id').equals('asset2').toArray();

    expect(user1Contacts).toHaveLength(1);
    expect(user1Assets).toHaveLength(1);
    expect(user1Blobs).toHaveLength(1);

    expect(user2Contacts).toHaveLength(1);
    expect(user2Assets).toHaveLength(1);
    expect(user2Blobs).toHaveLength(1);

    // Clear data for user 1 only
    await db.clearUserData(testUserId1);

    // Verify user 1's data was cleared but user 2's data remains
    const user1ContactsAfter = await db.contacts.where('master_user_id').equals(testUserId1).toArray();
    const user1AssetsAfter = await db.assets.where('master_user_id').equals(testUserId1).toArray();
    const user1BlobsAfter = await db.asset_blobs.where('asset_id').equals('asset1').toArray();

    const user2ContactsAfter = await db.contacts.where('master_user_id').equals(testUserId2).toArray();
    const user2AssetsAfter = await db.assets.where('master_user_id').equals(testUserId2).toArray();
    const user2BlobsAfter = await db.asset_blobs.where('asset_id').equals('asset2').toArray();

    expect(user1ContactsAfter).toHaveLength(0);
    expect(user1AssetsAfter).toHaveLength(0);
    expect(user1BlobsAfter).toHaveLength(0); // Associated blob should be deleted

    expect(user2ContactsAfter).toHaveLength(1); // User 2's data should remain
    expect(user2AssetsAfter).toHaveLength(1); // User 2's data should remain
    expect(user2BlobsAfter).toHaveLength(1); // User 2's blob should remain
  });

  test('should handle asset blob cleanup properly when assets exist', async () => {
    // Create an asset for user
    const asset = {
      id: 'asset3',
      name: 'Test Asset 3',
      file_name: 'test3.jpg',
      file_size: 1024,
      file_type: 'image',
      file_url: 'https://example.com/test3.jpg',
      uploaded_by: testUserId1,
      category: 'marketing' as const,
      mime_type: 'image/jpeg',
      is_public: false,
      master_user_id: testUserId1,
      _syncStatus: 'synced' as const,
      _lastModified: new Date().toISOString(),
      _version: 1,
      _deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Create blob for this asset
    const blob = new Blob(['test'], { type: 'image/jpeg' });
    await db.asset_blobs.add({
      asset_id: 'asset3',
      blob,
      mime_type: 'image/jpeg',
      size: 4,
      cached_at: new Date().toISOString(),
      last_accessed: new Date().toISOString(),
      _version: 1
    });

    await db.assets.add(asset);

    // Verify asset and blob exist
    const assetsBefore = await db.assets.where('master_user_id').equals(testUserId1).toArray();
    const blobsBefore = await db.asset_blobs.toArray();
    expect(assetsBefore).toHaveLength(1);
    expect(blobsBefore).toHaveLength(1);

    // Clear user data
    await db.clearUserData(testUserId1);

    // Verify both asset and blob are deleted
    const assetsAfter = await db.assets.where('master_user_id').equals(testUserId1).toArray();
    const assetBlobsAfter = await db.asset_blobs.where('asset_id').equals('asset3').toArray();
    expect(assetsAfter).toHaveLength(0);
    expect(assetBlobsAfter).toHaveLength(0);
  });

  test('should handle cleanup when no assets exist for user', async () => {
    // Clear user data when no assets exist for the user
    await expect(db.clearUserData('nonexistent-user')).resolves.not.toThrow();
    
    // Check that it didn't affect other data
    const allContacts = await db.contacts.toArray();
    const allAssets = await db.assets.toArray();
    const allBlobs = await db.asset_blobs.toArray();
    
    // Should still be empty since we cleared all in the previous test
    expect(allContacts).toHaveLength(0);
    expect(allAssets).toHaveLength(0);
    expect(allBlobs).toHaveLength(0);
  });
});
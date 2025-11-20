import { db } from '@/lib/db';

export class FirstTimeUserService {
  /**
   * Checks if a user is a "first-time user" by verifying the absence of key local data.
   * A user is considered first-time if they have no templates, contacts, or assets
   * stored locally for their master user ID.
   *
   * @param masterUserId The unique identifier for the master user.
   * @returns A promise that resolves to `true` if the user is a first-time user, otherwise `false`.
   */
  async checkIfFirstTimeUser(masterUserId: string): Promise<boolean> {
    if (!masterUserId) {
      console.warn('checkIfFirstTimeUser called without a masterUserId.');
      return true; // Treat as first-time user if no ID is provided, to be safe.
    }

    // Check for local data in parallel for efficiency
    const [hasTemplates, hasContacts, hasAssets] = await Promise.all([
      this.checkLocalTemplates(masterUserId),
      this.checkLocalContacts(masterUserId),
      this.checkLocalAssets(masterUserId),
    ]);

    // If none of the key data types exist, they are a first-time user.
    return !hasTemplates && !hasContacts && !hasAssets;
  }

  /**
   * Checks for the existence of local templates for a given user.
   * @param masterUserId The master user's ID.
   * @returns `true` if at least one template exists, otherwise `false`.
   */
  private async checkLocalTemplates(masterUserId: string): Promise<boolean> {
    try {
      const count = await db.templates.where('master_user_id').equals(masterUserId).count();
      return count > 0;
    } catch (error) {
      console.error('Failed to check local templates:', error);
      // In case of a DB error, assume data exists to prevent accidental full sync.
      return true;
    }
  }

  /**
   * Checks for the existence of local contacts for a given user.
   * @param masterUserId The master user's ID.
   * @returns `true` if at least one contact exists, otherwise `false`.
   */
  private async checkLocalContacts(masterUserId: string): Promise<boolean> {
    try {
      const count = await db.contacts.where('master_user_id').equals(masterUserId).count();
      return count > 0;
    } catch (error) {
      console.error('Failed to check local contacts:', error);
      return true;
    }
  }

  /**
   * Checks for the existence of local assets for a given user.
   * @param masterUserId The master user's ID.
   * @returns `true` if at least one asset exists, otherwise `false`.
   */
  private async checkLocalAssets(masterUserId: string): Promise<boolean> {
    try {
      const count = await db.assets.where('master_user_id').equals(masterUserId).count();
      return count > 0;
    } catch (error) {
      console.error('Failed to check local assets:', error);
      return true;
    }
  }
}
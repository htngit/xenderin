import { User, AuthResponse } from './types';
import { supabase, rpcHelpers, authHelpers, handleDatabaseError } from '../supabase';

export class AuthService {
  // Login with Supabase authentication
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      console.log('Starting login process for:', email);

      // Online mode: perform full authentication with Supabase
      const { user, session } = await authHelpers.signInWithEmail(email, password);

      if (!user) {
        throw new Error('No user returned from authentication');
      }

      console.log('User authenticated successfully:', user.id);

      // Get or create user profile
      const profile = await this.getOrCreateProfile(user);

      // Quota will be fetched after PIN validation and account selection
      // This supports the new Team Management flow

      const userData: User = {
        id: user.id,
        email: user.email!,
        name: profile?.name || user.email!.split('@')[0],
        role: profile?.role || 'owner',
        master_user_id: profile?.master_user_id || user.id,
        created_at: user.created_at
      };

      console.log('Login process completed successfully');

      return {
        user: userData,
        token: session?.access_token || ''
      };
    } catch (error) {
      console.error('Login error:', error);
      throw new Error(`Login failed: ${handleDatabaseError(error)}`);
    }
  }

  // Fetch metadata for a specific account (called after PIN validation)
  async getAccountMetadata(accountId: string): Promise<{ quota: any }> {
    try {
      console.log('Fetching metadata for account:', accountId);

      // Get user quota
      let quota;
      try {
        const quotaData = await rpcHelpers.getUserQuota(accountId);
        quota = quotaData[0];
      } catch (error) {
        console.warn('Failed to get existing quota:', error);
        quota = null;
      }

      // If no quota exists and it's the user's own account, try to create default
      if (!quota) {
        const currentUser = await this.getCurrentUser();
        if (currentUser && currentUser.id === accountId) {
          console.log('No quota found, creating default quota');
          quota = await this.createDefaultQuota(accountId);
        }
      }

      return { quota };
    } catch (error) {
      console.error('Get account metadata error:', error);
      throw error;
    }
  }

  // Forgot Password - Send reset email
  async forgotPassword(email: string): Promise<void> {
    try {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Please enter a valid email address');
      }

      // Send password reset email via Supabase with explicit redirect URL
      const redirectUrl = `${window.location.origin}/reset-password`;
      await authHelpers.resetPasswordForEmail(email, redirectUrl);

      console.log('Password reset email sent to:', email);
    } catch (error) {
      console.error('Forgot password error:', error);
      throw error;
    }
  }

  // Reset Password - Update with new password
  async resetPassword(newPassword: string): Promise<void> {
    try {
      // Validate password strength
      if (newPassword.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      // Update password via Supabase
      await authHelpers.updatePassword(newPassword);

      console.log('Password updated successfully');
    } catch (error) {
      console.error('Reset password error:', error);
      throw error;
    }
  }

  // Verify OTP token (for password reset confirmation)
  async verifyOtp(email: string, token: string, type: 'recovery' | 'signup' | 'email' = 'recovery'): Promise<boolean> {
    try {
      await authHelpers.verifyOtp(email, token, type);
      return true;
    } catch (error) {
      console.error('OTP verification error:', error);
      return false;
    }
  }

  // Register new user
  async register(email: string, password: string, name?: string): Promise<AuthResponse> {
    try {
      // Online mode: perform auth signup only - database triggers handle profile/quota creation
      const { user, session } = await authHelpers.signUpWithEmail(email, password, {
        name: name || email.split('@')[0]
      });

      if (!user) {
        throw new Error('No user returned from registration');
      }

      // Wait a moment for database triggers to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get the profile created by database triggers
      const profile = await this.getOrCreateProfile(user);

      // Quota is not fetched here anymore, it will be fetched after PIN/Account selection

      const userData: User = {
        id: user.id,
        email: user.email!,
        name: profile?.name || name || user.email!.split('@')[0],
        role: profile?.role || 'owner',
        master_user_id: profile?.master_user_id || user.id,
        created_at: user.created_at
      };

      return {
        user: userData,
        token: session?.access_token || ''
      };
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  // Validate token with Supabase
  async validateToken(token: string): Promise<boolean> {
    try {
      if (!token) return false;

      // Online mode: validate with Supabase
      const { session } = await authHelpers.getSession();
      return !!session?.user;
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  }

  // Logout from Supabase 
  async logout(): Promise<void> {
    try {
      // Online mode: perform full logout with Supabase
      await authHelpers.signOut();
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  // Get current user from Supabase
  async getCurrentUser(): Promise<User | null> {
    try {
      // Online mode: get from Supabase
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) return null;

      const profile = await this.getOrCreateProfile(user);

      const userData: User = {
        id: user.id,
        email: user.email!,
        name: profile?.name || user.email!.split('@')[0],
        role: profile?.role || 'owner',
        master_user_id: profile?.master_user_id || user.id,
        created_at: user.created_at
      };

      return userData;
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  }

  // Subscribe to auth state changes
  onAuthStateChange(callback: (user: User | null) => void) {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      // UserProvider will handle the user state management automatically
      if (session?.user) {
        try {
          const user = await this.getCurrentUser();
          callback(user);
        } catch (error) {
          console.error('Error getting user from auth state change:', error);
          callback(null);
        }
      } else {
        // Clear user context on logout - UserProvider will handle this
        callback(null);
      }
    });
  }

  // Enhanced user session management methods

  /**
   * Get current user ID (convenience method)
   */
  async getCurrentUserId(): Promise<string | null> {
    const user = await this.getCurrentUser();
    return user?.id || null;
  }

  /**
   * Get current master user ID (convenience method)
   */
  async getCurrentMasterUserId(): Promise<string | null> {
    const user = await this.getCurrentUser();
    return user?.master_user_id || null;
  }

  /**
   * Set current user context (for session management) - DEPRECATED
   * UserProvider now handles this automatically
   */
  async setCurrentUser(user: User, sessionToken?: string): Promise<void> {
    // This method is deprecated - UserProvider handles context management automatically
    console.warn('setCurrentUser is deprecated - UserProvider handles context management automatically');
  }

  /**
   * Clear current user context (for logout/session cleanup) - DEPRECATED
   * UserProvider now handles this automatically
   */
  async clearCurrentUser(): Promise<void> {
    // This method is deprecated - UserProvider handles context management automatically
    console.warn('clearCurrentUser is deprecated - UserProvider handles context management automatically');
  }

  /**
   * Validate current user session - simplified
   */
  async validateCurrentSession(): Promise<boolean> {
    const user = await this.getCurrentUser();
    return !!user;
  }

  /**
   * Get user session status - simplified
   */
  async getSessionStatus() {
    const user = await this.getCurrentUser();

    return {
      isAuthenticated: !!user,
      user: user,
      masterUserId: user?.master_user_id || null,
      sessionValid: !!user
    };
  }

  /**
   * Force session refresh
   */
  async refreshSession(): Promise<User | null> {
    try {
      // Online mode: re-validate with Supabase
      const { data: { user: supabaseUser }, error } = await supabase.auth.getUser();
      if (error || !supabaseUser) {
        return null;
      }

      // Get fresh profile data
      const profile = await this.getOrCreateProfile(supabaseUser);

      const userData: User = {
        id: supabaseUser.id,
        email: supabaseUser.email!,
        name: profile?.name || supabaseUser.email!.split('@')[0],
        role: profile?.role || 'owner',
        master_user_id: profile?.master_user_id || supabaseUser.id,
        created_at: supabaseUser.created_at
      };

      return userData;
    } catch (error) {
      console.error('Session refresh error:', error);
      return null;
    }
  }

  // Get or create user profile
  private async getOrCreateProfile(user: any) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
        throw error;
      }

      if (data) {
        return data;
      }

      // Create profile if doesn't exist
      console.log('Profile not found, creating new profile for user:', user.id);
      return await this.createProfile({
        id: user.id,
        email: user.email!,
        name: user.user_metadata?.name || user.email!.split('@')[0],
        role: 'owner',
        master_user_id: user.id
      });
    } catch (error) {
      console.error('Get or create profile error:', error);
      throw new Error(`Failed to get or create profile: ${handleDatabaseError(error)}`);
    }
  }

  // Create or update user profile
  private async createProfile(profileData: {
    id: string;
    email: string;
    name: string;
    role: string;
    master_user_id: string;
  }) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .upsert({
          id: profileData.id,
          email: profileData.email,
          name: profileData.name,
          role: profileData.role,
          master_user_id: profileData.master_user_id
        }, { onConflict: 'id' })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Create profile error:', error);
      throw error;
    }
  }

  // Create default quota for new user
  private async createDefaultQuota(userId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('user_quotas')
        .insert({
          user_id: userId,
          master_user_id: userId,
          plan_type: 'basic',
          messages_limit: 100,
          messages_used: 0,
          reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      // Add computed 'remaining' field for backward compatibility
      return {
        ...data,
        remaining: data.messages_limit - data.messages_used
      };
    } catch (error) {
      console.error('Create default quota error:', error);
      // Return mock quota if database creation fails
      return {
        id: 'default_quota',
        user_id: userId,
        master_user_id: userId,
        plan_type: 'basic',
        messages_limit: 100,
        messages_used: 0,
        remaining: 100,
        reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        is_active: true
      };
    }
  }
}
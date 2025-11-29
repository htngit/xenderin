import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '../services/types';
import { supabase } from '../supabase';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { userContextManager } from './UserContextManager';
import { db } from '../db';
import { syncManager } from '../sync/SyncManager';


/**
 * User Context Interface
 */
interface UserContextType {
  user: User | null;
  masterUserId: string | null;
  isLoading: boolean;
}

/**
 * Create User Context
 */
const UserContext = createContext<UserContextType | undefined>(undefined);

/**
 * UserProvider Props Interface
 */
interface UserProviderProps {
  children: ReactNode;
}

/**
 * UserProvider Component
 * 
 * Manages user authentication state and provides user context to child components.
 * Integrates with Supabase authentication and fetches user profile data.
 */
export function UserProvider({ children }: UserProviderProps) {
  // State management
  const [user, setUser] = useState<User | null>(null);
  const [masterUserId, setMasterUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Ref to track current user ID to avoid stale closures in useEffect
  const currentUserIdRef = React.useRef<string | null>(null);
  // Ref to track if sign-in is currently in progress to prevent race conditions
  const isSigningInRef = React.useRef<string | null>(null);

  // Update ref when user state changes
  useEffect(() => {
    currentUserIdRef.current = user?.id || null;
  }, [user]);

  /**
   * Fetch user profile from database
   */
  const fetchUserProfile = async (authUser: any): Promise<User | null> => {
    try {
      console.log('Fetching user profile for:', authUser.id);

      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timed out')), 15000);
      });

      // Race the supabase query against the timeout
      const { data, error } = await Promise.race([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single(),
        timeoutPromise.then(() => ({ data: null, error: { message: 'Timeout' } }))
      ]) as any;

      console.log('Supabase query completed', { data, error });

      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }

      if (data) {
        console.log('User profile found:', data.id);
        return data as User;
      }

      console.log('No profile found for user');
      return null;
    } catch (error) {
      console.error('Unexpected error in fetchUserProfile:', error);
      return null;
    }
  };

  /**
   * Handle user sign in
   */
  const handleSignIn = async (authUser: any, sessionToken?: string) => {
    // Prevent redundant fetching if user is already loaded
    if (currentUserIdRef.current === authUser.id) {
      console.log('User already loaded, skipping redundant fetch for:', authUser.id);
      // Ensure loading is false just in case
      setIsLoading(false);
      return;
    }

    // Prevent race conditions - if we are already signing in this user, skip
    if (isSigningInRef.current === authUser.id) {
      console.log('Sign-in already in progress for:', authUser.id);
      return;
    }

    try {
      console.log('handleSignIn started');
      isSigningInRef.current = authUser.id;
      setIsLoading(true);

      // Check if user has changed (different from the last user)
      const previousUserId = userContextManager.getLastUserId();

      if (previousUserId && previousUserId !== authUser.id) {
        console.log(`User switch detected: ${previousUserId} -> ${authUser.id}`);

        // Check if user has a stored preference
        const userPreference = localStorage.getItem('userSwitchPreference');
        const shouldRememberChoice = localStorage.getItem('userSwitchRememberChoice') === 'true';

        let shouldCleanup = true; // Default to cleanup

        if (shouldRememberChoice && userPreference) {
          // Use stored preference
          if (userPreference === 'keep') {
            shouldCleanup = false;
          } else if (userPreference === 'always') {
            shouldCleanup = true;
          }
        } else {
          // For now, we'll default to cleanup since we don't have a way to show the dialog here
          // The dialog would typically be shown in a component context that has access to React state
          shouldCleanup = true; // Default to cleanup
        }

        if (shouldCleanup) {
          // Clean up old user data if different user
          try {
            await db.clearUserData(previousUserId);
            await syncManager.clearSyncTimestamps();
            console.log(`Cleaned up data for previous user: ${previousUserId}`);
          } catch (cleanupError) {
            console.error('Error cleaning up previous user data:', cleanupError);
            // Continue with sign-in even if cleanup fails
          }
        } else {
          console.log(`Keeping data for previous user: ${previousUserId}`);
        }
      }

      const userProfile = await fetchUserProfile(authUser);

      if (userProfile) {
        console.log('Setting user state');
        setUser(userProfile);
        setMasterUserId(userProfile.master_user_id);
        // syncManager.setMasterUserId moved to App.tsx (after PIN)

        // Update UserContextManager
        try {
          // We just fetched the profile, so we can skip DB verification in UserContextManager
          // to avoid redundant network calls and potential timeouts
          const contextSet = await userContextManager.setCurrentUser(userProfile, sessionToken, { skipDbVerification: true });

          if (!contextSet) {
            console.error('UserContextManager failed to set user context (validation failed)');
            // Clear state to prevent inconsistent app state
            setUser(null);
            setMasterUserId(null);
          }
        } catch (ctxError) {
          console.error('Failed to set user context:', ctxError);
          setUser(null);
          setMasterUserId(null);
        }

        // Set this user as the last user now that sign-in is successful
        userContextManager.setLastUserId(userProfile.id);
      } else {
        // Handle case where profile doesn't exist yet (e.g. new signup)
        // We might want to create a profile here or redirect to a setup page
        console.log('No user profile found, creating default from auth data');
        const newUser: User = {
          id: authUser.id,
          email: authUser.email || '',
          name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
          role: 'owner',
          master_user_id: authUser.id, // Default to self as master
          created_at: new Date().toISOString()
        };
        setUser(newUser);
        setMasterUserId(newUser.master_user_id);
        // syncManager.setMasterUserId moved to App.tsx (after PIN)

        // Update UserContextManager with temporary user
        try {
          const contextSet = await userContextManager.setCurrentUser(newUser, sessionToken, { skipDbVerification: true });

          if (!contextSet) {
            console.error('UserContextManager failed to set temporary user context');
            setUser(null);
            setMasterUserId(null);
          }
        } catch (ctxError) {
          console.error('Failed to set temporary user context:', ctxError);
          setUser(null);
          setMasterUserId(null);
        }

        // Set this user as the last user now that sign-in is successful
        userContextManager.setLastUserId(newUser.id);
      }
    } catch (error) {
      console.error('Error in handleSignIn:', error);
    } finally {
      console.log('handleSignIn finally block - setting loading false');
      isSigningInRef.current = null;
      setIsLoading(false);
    }
  };

  /**
   * Handle user sign out
   */
  /**
   * Handle user sign out
   */
  const handleSignOut = async () => {
    try {
      await userContextManager.clearCurrentUser();
    } catch (error) {
      console.error('Error clearing user context:', error);
    }
    setUser(null);
    setMasterUserId(null);
    // syncManager.setMasterUserId(null) moved to App.tsx (handleLogout)
    setIsLoading(false);
  };

  /**
   * Setup Supabase authentication listener
   */
  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Error getting initial session:', error);
          setIsLoading(false);
          return;
        }

        if (session?.user) {
          await handleSignIn(session.user, session.access_token);
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error in getInitialSession:', error);
        setIsLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.id);

        switch (event) {
          case 'INITIAL_SESSION':
          case 'SIGNED_IN':
            if (session?.user) {
              console.log('Handling SIGNED_IN/INITIAL_SESSION for user:', session.user.id);
              await handleSignIn(session.user, session.access_token);
              console.log('handleSignIn completed for user:', session.user.id);
            } else {
              // If initial session is null, we are not signed in
              console.log('No session user found in SIGNED_IN/INITIAL_SESSION, setting loading false');
              setIsLoading(false);
            }
            break;

          case 'SIGNED_OUT':
            console.log('User signed out');
            await handleSignOut();
            break;

          case 'TOKEN_REFRESHED':
            // Handle token refresh if needed
            console.log('Token refreshed');
            break;

          case 'USER_UPDATED':
            // Handle user updates if needed
            console.log('User updated');
            break;

          default:
            console.log('Unhandled auth event:', event);
            // Ensure loading is false for unhandled events to prevent infinite loop
            setIsLoading(false);
        }
      }
    );

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Show loading screen while authentication is being determined
  if (isLoading) {
    return <LoadingScreen message="Authenticating user..." />;
  }

  // Provide user context to children
  return (
    <UserContext.Provider
      value={{
        user,
        masterUserId,
        isLoading
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

/**
 * useUser Hook
 * 
 * Custom hook to access user context from any component.
 * Must be used within a UserProvider.
 */
export function useUser(): UserContextType {
  const context = useContext(UserContext);

  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }

  return context;
}

/**
 * Additional utility hooks for convenience
 */

/**
 * Hook to check if user is authenticated
 */
export function useIsAuthenticated(): boolean {
  const { user, isLoading } = useUser();
  return !isLoading && user !== null;
}

/**
 * Hook to get current user role
 */
export function useUserRole(): 'owner' | 'staff' | null {
  const { user } = useUser();
  return user?.role ?? null;
}

/**
 * Hook to check if current user is owner
 */
export function useIsOwner(): boolean {
  const userRole = useUserRole();
  return userRole === 'owner';
}

/**
 * Hook to check if current user is staff
 */
export function useIsStaff(): boolean {
  const userRole = useUserRole();
  return userRole === 'staff';
}
import { create } from 'zustand';
import type { Profile } from '../core/types';
import {
  signUpWithEmail,
  signInWithEmail,
  signInWithApple,
  signInWithGoogle,
  signOut as authSignOut,
  deleteAccount as authDeleteAccount,
  getProfile,
  getSession,
  onAuthStateChange,
  updateDisplayName as authUpdateDisplayName,
} from '../services/supabase/auth';

type AuthState = {
  user: { id: string; email: string } | null;
  profile: Profile | null;
  isLoading: boolean;
  error: string | null;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInApple: () => Promise<void>;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  initialize: () => () => void;
  clearError: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  isLoading: true,
  error: null,

  signUp: async (email, password, username) => {
    set({ isLoading: true, error: null });
    try {
      const data = await signUpWithEmail(email, password, username);
      if (data.user) {
        set({
          user: { id: data.user.id, email: data.user.email ?? '' },
          isLoading: false,
        });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'An error occurred', isLoading: false });
    }
  },

  signIn: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const data = await signInWithEmail(email, password);
      if (data.user) {
        const profile = await getProfile(data.user.id);
        set({
          user: { id: data.user.id, email: data.user.email ?? '' },
          profile,
          isLoading: false,
        });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'An error occurred', isLoading: false });
    }
  },

  signInApple: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await signInWithApple();
      if (data.user) {
        const profile = await getProfile(data.user.id);
        set({
          user: { id: data.user.id, email: data.user.email ?? '' },
          profile,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (err) {
      // User cancelled is not an error
      if (err instanceof Error && 'code' in err && (err as { code: string }).code === 'ERR_REQUEST_CANCELED') {
        set({ isLoading: false });
        return;
      }
      set({ error: err instanceof Error ? err.message : 'An error occurred', isLoading: false });
    }
  },

  signInGoogle: async () => {
    set({ isLoading: true, error: null });
    try {
      await signInWithGoogle();
      set({ isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'An error occurred', isLoading: false });
    }
  },

  signOut: async () => {
    try {
      await authSignOut();
      set({ user: null, profile: null });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'An error occurred' });
    }
  },

  deleteAccount: async () => {
    try {
      await authDeleteAccount();
      set({ user: null, profile: null });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'An error occurred' });
      throw err;
    }
  },

  updateDisplayName: async (name) => {
    const state = useAuthStore.getState();
    if (!state.user) throw new Error('Not signed in');
    const updated = await authUpdateDisplayName(state.user.id, name);
    set({ profile: updated });
  },

  initialize: () => {
    // Helper to restore user + profile from a session
    const restoreFromSession = async (session: { user: { id: string; email?: string } } | null) => {
      if (session?.user) {
        const userObj = {
          id: session.user.id,
          email: session.user.email ?? '',
        };
        // Try to load profile, retry once after a short delay
        // (handles race condition where profile is still being created)
        let profile: Profile | null = null;
        try {
          profile = await getProfile(session.user.id);
        } catch {
          // Profile may not exist yet — wait and retry
          await new Promise((r) => setTimeout(r, 1500));
          try {
            profile = await getProfile(session.user.id);
          } catch {
            // Profile still missing — user/profile will be set by
            // the sign-in method or next auth state change
          }
        }
        set({ user: userObj, profile, isLoading: false });
      } else {
        set({ user: null, profile: null, isLoading: false });
      }
    };

    // Eagerly check for an existing session stored in AsyncStorage.
    // This prevents a race condition where the INITIAL_SESSION event
    // from onAuthStateChange fires before the listener is registered.
    getSession().then(restoreFromSession).catch(() => {
      set({ isLoading: false });
    });

    // Listen for future auth state changes (sign-in, sign-out, token refresh)
    const {
      data: { subscription },
    } = onAuthStateChange(async (_event, session) => {
      await restoreFromSession(session);
    });

    return () => subscription.unsubscribe();
  },

  clearError: () => set({ error: null }),
}));

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
  onAuthStateChange,
  updateDisplayName as authUpdateDisplayName,
} from '../services/supabase/auth';
import { useLeagueStore } from './useLeagueStore';

type AuthState = {
  user: { id: string; email: string } | null;
  profile: Profile | null;
  isLoading: boolean;
  signingOut: boolean;
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
  signingOut: false,
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
    set({ signingOut: true });
    try {
      // Timeout the server call — if token is expired, signOut can hang forever
      await Promise.race([
        authSignOut(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Sign out timed out')), 5000)),
      ]);
    } catch {
      // Whether signOut fails or times out, still clear local state.
      // The server session will expire on its own.
    }
    // ALWAYS clear local state regardless of server response
    set({ user: null, profile: null, signingOut: false });
    useLeagueStore.getState().reset();
  },

  deleteAccount: async () => {
    try {
      await authDeleteAccount();
      set({ user: null, profile: null });
      useLeagueStore.getState().reset();
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
    // Staleness guard: each auth event increments this counter.
    // After async work (profile fetch), we check if our ID is still
    // current — if not, a newer event has superseded us and we skip
    // overwriting profile (but we ALWAYS clear isLoading).
    let latestRestoreId = 0;

    const {
      data: { subscription },
    } = onAuthStateChange(async (event, session) => {
      const myId = ++latestRestoreId;

      // --- Signed out or no session ---
      if (event === 'SIGNED_OUT' || !session?.user) {
        set({ user: null, profile: null, isLoading: false });
        useLeagueStore.getState().reset();
        return;
      }

      // --- SIGNED_IN: sign-in methods already set user+profile, skip redundant work ---
      if (event === 'SIGNED_IN') {
        const current = useAuthStore.getState();
        if (current.user?.id === session.user.id && current.profile) {
          set({ isLoading: false });
          return;
        }
      }

      // --- INITIAL_SESSION: the stored token may be expired.
      // Force a server-side refresh to get a valid access token before any queries.
      if (event === 'INITIAL_SESSION') {
        try {
          const { getSession: refreshSession } = await import('../services/supabase/auth');
          await Promise.race([
            refreshSession(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Session refresh timeout')), 8000)),
          ]);
        } catch {
          // If refresh fails, the token is truly dead — force sign out
          set({ user: null, profile: null, isLoading: false });
          useLeagueStore.getState().reset();
          return;
        }
      }

      // --- TOKEN_REFRESHED or INITIAL_SESSION: restore user + profile ---

      // If user changed (different account), clear stale league data
      const prevUser = useAuthStore.getState().user;
      if (prevUser && prevUser.id !== session.user.id) {
        useLeagueStore.getState().reset();
      }

      // Set user immediately so UI can render
      const userObj = {
        id: session.user.id,
        email: session.user.email ?? '',
      };
      set({ user: userObj });

      // Load profile with timeout to prevent infinite hang
      let profile: Profile | null = null;
      const profileWithTimeout = (userId: string) =>
        Promise.race([
          getProfile(userId),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Profile fetch timeout')), 8000)),
        ]);

      try {
        profile = await profileWithTimeout(session.user.id);
      } catch {
        await new Promise((r) => setTimeout(r, 1500));
        try {
          profile = await profileWithTimeout(session.user.id);
        } catch {
          // Profile still missing — will be set by next auth event or sign-in method
        }
      }

      // Guard: if a newer auth event fired while we were fetching profile,
      // don't overwrite profile with our stale result — but ALWAYS clear isLoading
      // to prevent the UI from being stuck in a loading state.
      if (myId !== latestRestoreId) {
        // Only clear isLoading if it's still true (newer handler will handle the rest)
        if (useAuthStore.getState().isLoading) {
          set({ isLoading: false });
        }
        return;
      }

      set({ profile, isLoading: false });
    });

    return () => subscription.unsubscribe();
  },

  clearError: () => set({ error: null }),
}));

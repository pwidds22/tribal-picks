import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Profile } from '../core/types';
import {
  signUpWithEmail,
  signInWithEmail,
  signInWithApple,
  signInWithGoogle,
  signOut as authSignOut,
  signOutLocally,
  deleteAccount as authDeleteAccount,
  getProfile,
  onAuthStateChange,
  refreshSession,
  updateDisplayName as authUpdateDisplayName,
} from '../services/supabase/auth';
import { useLeagueStore } from './useLeagueStore';

type AuthState = {
  user: { id: string; email: string } | null;
  profile: Profile | null;
  isLoading: boolean;
  /** True once the stored token has been refreshed (or confirmed dead).
   *  Screens that need valid server calls should wait for this before fetching. */
  authReady: boolean;
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

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      profile: null,
      isLoading: true,
      authReady: false,
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
          await Promise.race([
            authSignOut(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Sign out timed out')), 5000)),
          ]);
        } catch {
          // Whether signOut fails or times out, still clear local state.
        }
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
        let latestRestoreId = 0;

        const {
          data: { subscription },
        } = onAuthStateChange(async (event, session) => {
          const myId = ++latestRestoreId;

          if (event === 'SIGNED_OUT' || !session?.user) {
            set({ user: null, profile: null, isLoading: false, authReady: true });
            useLeagueStore.getState().reset();
            return;
          }

          if (event === 'SIGNED_IN') {
            const current = useAuthStore.getState();
            if (current.user?.id === session.user.id && current.profile) {
              set({ isLoading: false, authReady: true });
              return;
            }
          }

          // INITIAL_SESSION: token from storage may or may not be expired.
          // Check expires_at to decide whether we can skip the refresh wait.
          if (event === 'INITIAL_SESSION') {
            const now = Math.floor(Date.now() / 1000);
            const expiresAt = session.expires_at ?? 0;
            const tokenStillValid = expiresAt > now + 60; // 60s safety buffer

            if (tokenStillValid) {
              // Token is still valid — set authReady NOW so screens work instantly.
              // Refresh in background to extend the token's lifetime.
              set({ authReady: true });
              refreshSession().catch(() => {});
            } else {
              // Token is expired — must wait for refresh before server calls work.
              try {
                await Promise.race([
                  refreshSession(),
                  new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
                ]);
                if (myId !== latestRestoreId) return;
              } catch {
                // Token is dead — force re-login
                try { await signOutLocally(); } catch { /* ignore */ }
                set({ user: null, profile: null, isLoading: false, authReady: true });
                useLeagueStore.getState().reset();
                return;
              }
            }
          }

          const prevUser = useAuthStore.getState().user;
          if (prevUser && prevUser.id !== session.user.id) {
            useLeagueStore.getState().reset();
          }

          set({
            user: { id: session.user.id, email: session.user.email ?? '' },
            isLoading: false,
            authReady: true,
          });

          // Fetch fresh profile in background
          const profileWithTimeout = (userId: string) =>
            Promise.race([
              getProfile(userId),
              new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Profile fetch timeout')), 8000)),
            ]);

          try {
            const profile = await profileWithTimeout(session.user.id);
            if (myId === latestRestoreId) set({ profile });
          } catch {
            await new Promise((r) => setTimeout(r, 1500));
            try {
              const profile = await profileWithTimeout(session.user.id);
              if (myId === latestRestoreId) set({ profile });
            } catch {
              // Profile still missing
            }
          }
        });

        return () => subscription.unsubscribe();
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'tribal-picks-auth',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist user + profile. NOT isLoading/error/signingOut/authReady.
      partialize: (state) => ({
        user: state.user,
        profile: state.profile,
      }),
      onRehydrateStorage: () => (state) => {
        // If we have a cached user from last session, clear isLoading
        // so screens show cached content immediately instead of a spinner.
        if (state?.user) {
          useAuthStore.setState({ isLoading: false });
        }
      },
    },
  ),
);

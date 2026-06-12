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
  isTransientAuthError,
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

        // Runs OUTSIDE the auth callback so auth-js's event pipeline (which
        // awaits every subscriber) is never blocked on a network round trip.
        const fetchProfileInBackground = (userId: string, myId: number) => {
          const profileWithTimeout = () =>
            Promise.race([
              getProfile(userId),
              new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Profile fetch timeout')), 8000)),
            ]);
          void (async () => {
            try {
              const profile = await profileWithTimeout();
              if (myId === latestRestoreId) set({ profile });
            } catch {
              await new Promise((r) => setTimeout(r, 1500));
              try {
                const profile = await profileWithTimeout();
                if (myId === latestRestoreId) set({ profile });
              } catch {
                // Keep whatever profile is cached
              }
            }
          })();
        };

        const {
          data: { subscription },
        } = onAuthStateChange((event, session) => {
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

          // Token freshness is supabase-js's job: getSession() refreshes an
          // expired token on demand (deduped) before any query goes out, so
          // the UI must NEVER wait on a refresh. On cold start, if the token
          // is near expiry, kick a refresh now so the first queries don't pay
          // for it — but only a definitive auth rejection signs the user out.
          // Network failures keep the session; the auto-refresh ticker retries.
          if (event === 'INITIAL_SESSION') {
            const now = Math.floor(Date.now() / 1000);
            const expiresAt = session.expires_at ?? 0;
            if (expiresAt < now + 300) {
              refreshSession().catch(async (err) => {
                if (isTransientAuthError(err)) return;
                try { await signOutLocally(); } catch { /* ignore */ }
                set({ user: null, profile: null, isLoading: false, authReady: true });
                useLeagueStore.getState().reset();
              });
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

          // Refresh the cached profile on cold start; on later events
          // (e.g. TOKEN_REFRESHED every ~55min) only fetch if it's missing.
          const haveProfile = useAuthStore.getState().profile != null;
          if (event === 'INITIAL_SESSION' || !haveProfile) {
            fetchProfileInBackground(session.user.id, myId);
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

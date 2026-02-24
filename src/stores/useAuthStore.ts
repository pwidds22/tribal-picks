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
      await signInWithApple();
      set({ isLoading: false });
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

  initialize: () => {
    const {
      data: { subscription },
    } = onAuthStateChange(async (event, session) => {
      if (session?.user) {
        try {
          const profile = await getProfile(session.user.id);
          set({
            user: {
              id: session.user.id,
              email: session.user.email ?? '',
            },
            profile,
            isLoading: false,
          });
        } catch {
          set({
            user: {
              id: session.user.id,
              email: session.user.email ?? '',
            },
            isLoading: false,
          });
        }
      } else {
        set({ user: null, profile: null, isLoading: false });
      }
    });

    return () => subscription.unsubscribe();
  },

  clearError: () => set({ error: null }),
}));

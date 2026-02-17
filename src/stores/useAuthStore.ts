import { create } from 'zustand';
import type { Profile } from '../core/types';
import {
  signUpWithEmail,
  signInWithEmail,
  signInWithApple,
  signInWithGoogle,
  signOut as authSignOut,
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
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
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
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  signInApple: async () => {
    set({ isLoading: true, error: null });
    try {
      await signInWithApple();
      set({ isLoading: false });
    } catch (err: any) {
      // User cancelled is not an error
      if (err.code === 'ERR_REQUEST_CANCELED') {
        set({ isLoading: false });
        return;
      }
      set({ error: err.message, isLoading: false });
    }
  },

  signInGoogle: async () => {
    set({ isLoading: true, error: null });
    try {
      await signInWithGoogle();
      set({ isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  signOut: async () => {
    try {
      await authSignOut();
      set({ user: null, profile: null });
    } catch (err: any) {
      set({ error: err.message });
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

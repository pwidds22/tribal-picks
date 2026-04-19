import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { League } from '../core/types';
import { getUserLeagues, deleteLeague as deleteLeagueQuery } from '../services/supabase/queries';
import { onAppResume } from '../services/supabase/client';

type LeagueState = {
  leagues: League[];
  isLoading: boolean;
  error: string | null;
  lastFetched: number;
  fetchLeagues: (userId: string, _retry?: boolean) => Promise<void>;
  deleteLeague: (leagueId: string) => Promise<void>;
  invalidate: () => void;
  reset: () => void;
};

const STALE_MS = 60 * 1000; // 1 minute

export const useLeagueStore = create<LeagueState>()(
  persist(
    (set, get) => ({
      leagues: [],
      isLoading: false,
      error: null,
      lastFetched: 0,

      fetchLeagues: async (userId: string, _retry = false) => {
        const now = Date.now();
        if (!_retry && get().leagues.length > 0 && now - get().lastFetched < STALE_MS) return;

        set({ isLoading: true, error: null });
        try {
          const leagues = await Promise.race([
            getUserLeagues(userId),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Request timed out')), 10000)),
          ]);
          set({ leagues, isLoading: false, lastFetched: Date.now() });
        } catch (err) {
          if (!_retry) {
            await new Promise((r) => setTimeout(r, 2000));
            return get().fetchLeagues(userId, true);
          }
          // On error, keep any cached leagues — don't overwrite with empty
          set({ error: err instanceof Error ? err.message : 'An error occurred', isLoading: false });
        }
      },

      deleteLeague: async (leagueId: string) => {
        await deleteLeagueQuery(leagueId);
        set((state) => ({
          leagues: state.leagues.filter((l) => l.id !== leagueId),
        }));
      },

      invalidate: () => set({ lastFetched: 0 }),

      reset: () => set({ leagues: [], isLoading: false, error: null, lastFetched: 0 }),
    }),
    {
      name: 'tribal-picks-leagues',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist leagues. NOT isLoading/error/lastFetched.
      partialize: (state) => ({
        leagues: state.leagues,
      }),
    },
  ),
);

// When the app returns to foreground (after token refresh), invalidate and re-fetch
onAppResume(() => {
  const { useAuthStore } = require('./useAuthStore');
  const user = useAuthStore.getState().user;
  if (user) {
    useLeagueStore.getState().invalidate();
    useLeagueStore.getState().fetchLeagues(user.id);
  }
});

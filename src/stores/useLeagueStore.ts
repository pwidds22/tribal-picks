import { create } from 'zustand';
import type { League } from '../core/types';
import { getUserLeagues, deleteLeague as deleteLeagueQuery } from '../services/supabase/queries';

type LeagueState = {
  leagues: League[];
  isLoading: boolean;
  error: string | null;
  lastFetched: number;
  fetchLeagues: (userId: string) => Promise<void>;
  deleteLeague: (leagueId: string) => Promise<void>;
  invalidate: () => void;
  reset: () => void;
};

const STALE_MS = 60 * 1000; // 1 minute

export const useLeagueStore = create<LeagueState>((set, get) => ({
  leagues: [],
  isLoading: false,
  error: null,
  lastFetched: 0,

  fetchLeagues: async (userId: string) => {
    const now = Date.now();
    if (get().leagues.length > 0 && now - get().lastFetched < STALE_MS) return;

    set({ isLoading: true, error: null });
    try {
      const leagues = await getUserLeagues(userId);
      set({ leagues, isLoading: false, lastFetched: Date.now() });
    } catch (err) {
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
}));

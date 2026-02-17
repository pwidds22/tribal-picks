import { create } from 'zustand';
import type { League } from '../core/types';
import { getUserLeagues } from '../services/supabase/queries';

type LeagueState = {
  leagues: League[];
  isLoading: boolean;
  error: string | null;
  lastFetched: number;
  fetchLeagues: (userId: string) => Promise<void>;
  invalidate: () => void;
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
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  invalidate: () => set({ lastFetched: 0 }),
}));

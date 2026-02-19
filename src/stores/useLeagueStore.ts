import { create } from 'zustand';
import type { League } from '../core/types';
import { getUserLeagues } from '../services/supabase/queries';
import { supabase } from '../services/supabase/client';

type LeagueState = {
  leagues: League[];
  isLoading: boolean;
  error: string | null;
  lastFetched: number;
  fetchLeagues: (userId: string) => Promise<void>;
  deleteLeague: (leagueId: string) => Promise<void>;
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

  deleteLeague: async (leagueId: string) => {
    const { error } = await supabase
      .from('leagues')
      .delete()
      .eq('id', leagueId);
    if (error) throw new Error(error.message);
    set((state) => ({
      leagues: state.leagues.filter((l) => l.id !== leagueId),
    }));
  },

  invalidate: () => set({ lastFetched: 0 }),
}));

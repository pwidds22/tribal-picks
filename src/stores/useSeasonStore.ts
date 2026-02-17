import { create } from 'zustand';
import type { Season, Episode } from '../core/types';
import { getActiveSeason, getNextEpisode } from '../services/supabase/queries';

type SeasonState = {
  season: Season | null;
  nextEpisode: Episode | null;
  isLoading: boolean;
  error: string | null;
  lastFetched: number;
  fetchSeason: () => Promise<void>;
};

const STALE_MS = 5 * 60 * 1000; // 5 minutes

export const useSeasonStore = create<SeasonState>((set, get) => ({
  season: null,
  nextEpisode: null,
  isLoading: false,
  error: null,
  lastFetched: 0,

  fetchSeason: async () => {
    const now = Date.now();
    if (get().season && now - get().lastFetched < STALE_MS) return;

    set({ isLoading: true, error: null });
    try {
      const season = await getActiveSeason();
      let nextEpisode: Episode | null = null;
      if (season) {
        nextEpisode = await getNextEpisode(season.id);
      }
      set({ season, nextEpisode, isLoading: false, lastFetched: Date.now() });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },
}));

import { create } from 'zustand';
import type { Season, Episode } from '../core/types';
import { getActiveSeason, getEpisodes, getSeasons } from '../services/supabase/queries';

type SeasonState = {
  /** The season open for new leagues. Leagues from other seasons are "past". */
  season: Season | null;
  /** All seasons, newest first (for labeling past-season leagues). */
  seasons: Season[];
  /** All episodes of the active season, in order. */
  episodes: Episode[];
  /** Next unscored episode of the active season. */
  nextEpisode: Episode | null;
  isLoading: boolean;
  error: string | null;
  lastFetched: number;
  fetchSeason: (force?: boolean) => Promise<void>;
};

const STALE_MS = 5 * 60 * 1000; // 5 minutes

export const useSeasonStore = create<SeasonState>((set, get) => ({
  season: null,
  seasons: [],
  episodes: [],
  nextEpisode: null,
  isLoading: false,
  error: null,
  lastFetched: 0,

  fetchSeason: async (force = false) => {
    const now = Date.now();
    if (!force && get().season && now - get().lastFetched < STALE_MS) return;

    set({ isLoading: true, error: null });
    try {
      const [season, seasons] = await Promise.all([getActiveSeason(), getSeasons()]);
      const episodes = season ? await getEpisodes(season.id) : [];
      const nextEpisode = episodes.find((e) => !e.is_scored) ?? null;
      set({ season, seasons, episodes, nextEpisode, isLoading: false, lastFetched: Date.now() });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'An error occurred', isLoading: false });
    }
  },
}));

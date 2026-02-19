// ============================================
// Tribal Picks: Survivor Fantasy - Core Types
// ============================================

// ---------- Database Row Types ----------

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_premium: boolean;
  created_at: string;
};

export type Season = {
  id: number;
  number: number;
  name: string | null;
  premiere_date: string | null;
  finale_date: string | null;
  is_active: boolean;
};

export type Castaway = {
  id: number;
  season_id: number;
  name: string;
  age: number | null;
  hometown: string | null;
  occupation: string | null;
  tribe: string | null;
  photo_url: string | null;
  is_eliminated: boolean;
  elimination_episode: number | null;
  elimination_order: number | null;
};

export type GameType = 'bracket' | 'draft' | 'weekly' | 'survivor_pool';

export type League = {
  id: string;
  name: string;
  invite_code: string;
  game_type: GameType;
  season_id: number;
  commissioner_id: string;
  is_public: boolean;
  start_episode: number;
  max_members: number;
  created_at: string;
};

export type LeagueMember = {
  league_id: string;
  user_id: string;
  joined_at: string;
};

export type Episode = {
  id: number;
  season_id: number;
  number: number;
  air_date: string | null;
  title: string | null;
  immunity_winner_id: number | null;
  eliminated_id: number | null;
  is_scored: boolean;
};

// ---------- Game-Specific Types ----------

// Game 1: Elimination Bracket (season-long)
export type BracketPick = {
  id: number;
  league_id: string;
  user_id: string;
  castaway_id: number;
  predicted_position: number; // 1 = first out, 18 = winner
  actual_position: number | null;
  points: number;
};

// Game 2: Cast Draft (season-long)
export type DraftPick = {
  id: number;
  league_id: string;
  user_id: string;
  castaway_id: number;
  draft_order: number;
  total_points: number;
};

// Game 3: Weekly Pick'em
export type WeeklyPick = {
  id: number;
  league_id: string;
  user_id: string;
  episode_id: number;
  picked_eliminated_id: number; // who they think goes home
  picked_immunity_id: number;   // who they think wins immunity
  points: number;
};

// Game 4: Survivor Pool (NFL survivor style)
export type SurvivorPoolPick = {
  id: number;
  league_id: string;
  user_id: string;
  episode_id: number;
  picked_castaway_id: number; // who they think survives
  is_alive: boolean;          // still in the pool?
};

// ---------- Admin / Sync Types ----------

export type NameAlias = {
  id: number;
  castaway_id: number;
  alias: string;
};

export type SyncLog = {
  id: number;
  ran_at: string;
  trigger_source: string;
  episodes_updated: number;
  picks_scored: number;
  errors: string[] | null;
  wiki_hash: string | null;
};

// ---------- App State Types ----------

export type LeagueWithMembers = League & {
  members: LeagueMember[];
  member_count: number;
};

export type CastawayWithStats = Castaway & {
  total_points: number;
  immunity_wins: number;
  reward_wins: number;
};

export type LeaderboardEntry = {
  user_id: string;
  username: string;
  display_name: string | null;
  total_points: number;
  rank: number;
};

export type SurvivorPoolStandingEntry = {
  user_id: string;
  username: string;
  display_name: string | null;
  is_alive: boolean;
  eliminated_in_episode: number | null;
  rank: number;
};

// ---------- Scoring Constants ----------
// Escalating position-value system: later positions are worth more,
// with accuracy multipliers and milestone bonuses.

/**
 * Base point values by elimination position (1-indexed).
 * Positions grouped into tiers that escalate toward endgame.
 *
 * Pre-merge (1-10):   2 → 6 pts (low stakes, many castaways)
 * Merge     (11-12):  8 pts each (merge is a key milestone)
 * Post-merge (13):   10 pts (individual game begins)
 * Endgame   (14-18): 12 → 20 pts (highest stakes, hardest to predict)
 *
 * Base values for an 18-castaway season:
 *  #1-#2 = 2,  #3-#4 = 3,  #5-#6 = 4,  #7-#8 = 5,  #9-#10 = 6,
 *  #11-#12 = 8,  #13 = 10,
 *  #14 = 12,  #15 = 14,  #16 = 16,  #17 = 18,  #18 = 20
 */
export const BRACKET_POSITION_VALUES: Record<number, number> = {
  1: 2,  2: 2,
  3: 3,  4: 3,
  5: 4,  6: 4,
  7: 5,  8: 5,
  9: 6,  10: 6,
  11: 8, 12: 8,
  13: 10,
  14: 12,
  15: 14,
  16: 16,
  17: 18,
  18: 20,
};

/**
 * Accuracy multipliers: how much of the base value you earn
 * based on how close your prediction was.
 *
 * Exact match = full points. Off by 1 = half. Off by 2 = quarter.
 * Off by 3 or more = zero. This is the key differentiator from the
 * old system — bad picks earn nothing.
 */
export const BRACKET_ACCURACY = {
  EXACT: 1.0,    // 100% of base value
  OFF_BY_1: 0.5, //  50% of base value
  OFF_BY_2: 0.25, // 25% of base value
  OFF_BY_3_PLUS: 0, // 0 — wrong region, no points
} as const;

/**
 * Bonus points for milestone predictions.
 *
 * Sole Survivor exact:    +15 (hardest single prediction)
 * Perfect endgame (14-18): +10 (all 5 endgame positions exact)
 * First boot exact:        +5  (crowd-favorite high-risk pick)
 *
 * Max possible = sum(all base values) + 15 + 10 + 5 = 176 pts
 */
export const BRACKET_BONUSES = {
  SOLE_SURVIVOR_EXACT: 15,
  PERFECT_ENDGAME: 10, // all of positions 14-18 exact
  FIRST_BOOT_EXACT: 5,
} as const;

// Keep legacy constants for backward compatibility during migration
export const BRACKET_SCORING = {
  EXACT: 10,
  OFF_BY_1: 7,
  OFF_BY_2: 4,
  OFF_BY_3_PLUS: 1,
  CORRECT_WINNER_BONUS: 25,
} as const;

export const DRAFT_SCORING = {
  SURVIVE_EPISODE: 5,
  WIN_IMMUNITY: 15,
  WIN_REWARD: 10,
  FIND_IDOL: 20,
  PLAY_IDOL_CORRECTLY: 25,
  WIN_FIRE_MAKING: 15,
  MAKE_MERGE: 10,
  FINALIST: 20,
  SOLE_SURVIVOR: 50,
} as const;

export const WEEKLY_SCORING = {
  CORRECT_VOTE_OUT: 10,
  CORRECT_IMMUNITY: 10,
  CORRECT_VOTE_SPLIT_BONUS: 5,
} as const;

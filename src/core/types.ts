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

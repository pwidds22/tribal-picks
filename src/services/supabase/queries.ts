import { supabase } from './client';
import type {
  Season,
  Castaway,
  League,
  Episode,
  BracketPick,
  SurvivorPoolPick,
  GameType,
} from '../../core/types';

// ============================================
// Seasons
// ============================================

export async function getActiveSeason(): Promise<Season | null> {
  const { data, error } = await supabase
    .from('seasons')
    .select('*')
    .eq('is_active', true)
    .single();

  if (error) return null;
  return data;
}

// ============================================
// Castaways
// ============================================

export async function getCastaways(seasonId: number): Promise<Castaway[]> {
  const { data, error } = await supabase
    .from('castaways')
    .select('*')
    .eq('season_id', seasonId)
    .order('name');

  if (error) throw error;
  return data ?? [];
}

export async function getCastawaysAliveAtEpisode(
  seasonId: number,
  episodeNumber: number
): Promise<Castaway[]> {
  const { data, error } = await supabase
    .from('castaways')
    .select('*')
    .eq('season_id', seasonId)
    .or(`elimination_episode.is.null,elimination_episode.gte.${episodeNumber}`)
    .order('name');

  if (error) throw error;
  return data ?? [];
}

export async function getCastawaysByTribe(
  seasonId: number
): Promise<Record<string, Castaway[]>> {
  const castaways = await getCastaways(seasonId);
  const byTribe: Record<string, Castaway[]> = {};

  for (const c of castaways) {
    const tribe = c.tribe ?? 'Unknown';
    if (!byTribe[tribe]) byTribe[tribe] = [];
    byTribe[tribe].push(c);
  }

  return byTribe;
}

// ============================================
// Leagues
// ============================================

export async function createLeague(
  name: string,
  gameType: GameType,
  seasonId: number,
  commissionerId: string,
  isPublic: boolean = false,
  startEpisode: number = 1
): Promise<League> {
  const inviteCode = generateInviteCode();

  const { data, error } = await supabase
    .from('leagues')
    .insert({
      name,
      invite_code: inviteCode,
      game_type: gameType,
      season_id: seasonId,
      commissioner_id: commissionerId,
      is_public: isPublic,
      start_episode: startEpisode,
    })
    .select()
    .single();

  if (error) throw error;

  // Auto-join as commissioner
  await joinLeague(data.id, commissionerId);

  return data;
}

export async function joinLeague(
  leagueId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('league_members')
    .insert({ league_id: leagueId, user_id: userId });

  if (error) throw error;
}

export async function joinLeagueByCode(
  inviteCode: string,
  userId: string
): Promise<League> {
  const { data, error } = await supabase
    .rpc('lookup_league_by_invite_code', { p_invite_code: inviteCode })
    .single();

  if (error || !data) throw new Error('League not found. Check the invite code.');

  const league = data as unknown as League;
  await joinLeague(league.id, userId);
  return league;
}

export async function getUserLeagues(userId: string): Promise<League[]> {
  const { data, error } = await supabase
    .from('league_members')
    .select('league_id, leagues(*)')
    .eq('user_id', userId);

  if (error) throw error;
  return (data ?? [])
    .map((d) => (d as unknown as { leagues: League | null }).leagues)
    .filter((l): l is League => l != null);
}

export async function getLeague(leagueId: string): Promise<League | null> {
  const { data, error } = await supabase
    .from('leagues')
    .select('*')
    .eq('id', leagueId)
    .single();

  if (error) return null;
  return data;
}

export async function getLeagueMembers(
  leagueId: string
): Promise<{ user_id: string; username: string; display_name: string | null }[]> {
  const { data, error } = await supabase
    .from('league_members')
    .select('user_id, profiles(username, display_name)')
    .eq('league_id', leagueId);

  if (error) throw error;
  return (data ?? []).map((d) => {
    const row = d as unknown as { user_id: string; profiles: { username: string; display_name: string | null } | null };
    return {
      user_id: row.user_id,
      username: row.profiles?.username ?? 'Unknown',
      display_name: row.profiles?.display_name ?? null,
    };
  });
}

// ============================================
// Episodes
// ============================================

export async function getEpisodes(seasonId: number): Promise<Episode[]> {
  const { data, error } = await supabase
    .from('episodes')
    .select('*')
    .eq('season_id', seasonId)
    .order('number');

  if (error) throw error;
  return data ?? [];
}

export async function getNextEpisode(seasonId: number): Promise<Episode | null> {
  const { data, error } = await supabase
    .from('episodes')
    .select('*')
    .eq('season_id', seasonId)
    .eq('is_scored', false)
    .order('number')
    .limit(1)
    .single();

  if (error) return null;
  return data;
}

export async function getEpisodeByNumber(
  seasonId: number,
  episodeNumber: number
): Promise<Episode | null> {
  const { data, error } = await supabase
    .from('episodes')
    .select('*')
    .eq('season_id', seasonId)
    .eq('number', episodeNumber)
    .single();

  if (error) return null;
  return data;
}

export async function getNextEpisodeFromStart(
  seasonId: number,
  startEpisodeNumber: number
): Promise<Episode | null> {
  const { data, error } = await supabase
    .from('episodes')
    .select('*')
    .eq('season_id', seasonId)
    .eq('is_scored', false)
    .gte('number', startEpisodeNumber)
    .order('number')
    .limit(1)
    .single();

  if (error) return null;
  return data;
}

// ============================================
// Bracket Picks
// ============================================

export async function saveBracketPicks(
  leagueId: string,
  userId: string,
  picks: { castaway_id: number; predicted_position: number }[]
): Promise<void> {
  const rows = picks.map((p) => ({
    league_id: leagueId,
    user_id: userId,
    castaway_id: p.castaway_id,
    predicted_position: p.predicted_position,
  }));

  const { error } = await supabase.from('bracket_picks').upsert(rows, {
    onConflict: 'league_id,user_id,castaway_id',
  });

  if (error) throw error;
}

export async function getBracketPicks(
  leagueId: string,
  userId: string
): Promise<BracketPick[]> {
  const { data, error } = await supabase
    .from('bracket_picks')
    .select('*')
    .eq('league_id', leagueId)
    .eq('user_id', userId)
    .order('predicted_position');

  if (error) throw error;
  return data ?? [];
}

// ============================================
// Survivor Pool Picks
// ============================================

export async function saveSurvivorPoolPick(
  leagueId: string,
  userId: string,
  episodeId: number,
  castawayId: number,
  winnerPickId?: number
): Promise<void> {
  const row: Record<string, unknown> = {
    league_id: leagueId,
    user_id: userId,
    episode_id: episodeId,
    picked_castaway_id: castawayId,
  };
  if (winnerPickId !== undefined) {
    row.winner_pick_id = winnerPickId;
  }
  const { error } = await supabase.from('survivor_pool_picks').upsert(
    row,
    { onConflict: 'league_id,user_id,episode_id' }
  );

  if (error) throw error;
}

export async function getSurvivorPoolPicks(
  leagueId: string,
  userId: string
): Promise<SurvivorPoolPick[]> {
  const { data, error } = await supabase
    .from('survivor_pool_picks')
    .select('*')
    .eq('league_id', leagueId)
    .eq('user_id', userId)
    .order('episode_id');

  if (error) throw error;
  return data ?? [];
}

export async function getSurvivorPoolStatus(
  leagueId: string
): Promise<{ user_id: string; is_alive: boolean; username: string }[]> {
  const { data, error } = await supabase
    .from('survivor_pool_picks')
    .select('user_id, is_alive, profiles(username)')
    .eq('league_id', leagueId)
    .order('is_alive', { ascending: false });

  if (error) throw error;

  // Deduplicate by user — alive if any pick is alive
  const userMap = new Map<string, { is_alive: boolean; username: string }>();
  for (const d of data ?? []) {
    const existing = userMap.get(d.user_id);
    if (!existing || d.is_alive) {
      userMap.set(d.user_id, {
        is_alive: d.is_alive,
        username: (d as unknown as { profiles?: { username: string } }).profiles?.username ?? 'Unknown',
      });
    }
  }

  return Array.from(userMap.entries()).map(([user_id, v]) => ({
    user_id,
    ...v,
  }));
}

// ============================================
// League-wide Picks (for visibility after lock)
// ============================================

/** All users' bracket picks in a league, with castaway names. */
export async function getAllBracketPicks(
  leagueId: string
): Promise<
  {
    user_id: string;
    castaway_id: number;
    castaway_name: string;
    predicted_position: number;
    points: number;
  }[]
> {
  const { data, error } = await supabase
    .from('bracket_picks')
    .select('user_id, castaway_id, predicted_position, points, castaways(name)')
    .eq('league_id', leagueId)
    .order('predicted_position');

  if (error) throw error;
  return (data ?? []).map((d) => {
    const row = d as unknown as {
      user_id: string;
      castaway_id: number;
      predicted_position: number;
      points: number;
      castaways: { name: string } | null;
    };
    return {
      user_id: row.user_id,
      castaway_id: row.castaway_id,
      castaway_name: row.castaways?.name ?? 'Unknown',
      predicted_position: row.predicted_position,
      points: row.points,
    };
  });
}

/** All users' pool picks for a specific episode, with castaway names. */
export async function getAllPoolPicksForEpisode(
  leagueId: string,
  episodeId: number
): Promise<
  {
    user_id: string;
    picked_castaway_id: number;
    castaway_name: string;
    is_alive: boolean;
  }[]
> {
  const { data, error } = await supabase
    .from('survivor_pool_picks')
    .select('user_id, picked_castaway_id, is_alive, castaways!survivor_pool_picks_picked_castaway_id_fkey(name)')
    .eq('league_id', leagueId)
    .eq('episode_id', episodeId);

  if (error) throw error;
  return (data ?? []).map((d) => {
    const row = d as unknown as {
      user_id: string;
      picked_castaway_id: number;
      is_alive: boolean;
      castaways: { name: string } | null;
    };
    return {
      user_id: row.user_id,
      picked_castaway_id: row.picked_castaway_id,
      castaway_name: row.castaways?.name ?? 'Unknown',
      is_alive: row.is_alive,
    };
  });
}

/** One user's pool picks across all episodes (for historical view). */
export async function getUserPoolPickHistory(
  leagueId: string,
  userId: string
): Promise<
  {
    episode_id: number;
    episode_number: number;
    picked_castaway_id: number;
    castaway_name: string;
    is_alive: boolean;
  }[]
> {
  const { data, error } = await supabase
    .from('survivor_pool_picks')
    .select('episode_id, picked_castaway_id, is_alive, castaways!survivor_pool_picks_picked_castaway_id_fkey(name), episodes!survivor_pool_picks_episode_id_fkey(number)')
    .eq('league_id', leagueId)
    .eq('user_id', userId)
    .order('episode_id');

  if (error) throw error;
  return (data ?? []).map((d) => {
    const row = d as unknown as {
      episode_id: number;
      picked_castaway_id: number;
      is_alive: boolean;
      castaways: { name: string } | null;
      episodes: { number: number } | null;
    };
    return {
      episode_id: row.episode_id,
      episode_number: row.episodes?.number ?? 0,
      picked_castaway_id: row.picked_castaway_id,
      castaway_name: row.castaways?.name ?? 'Unknown',
      is_alive: row.is_alive,
    };
  });
}

// ============================================
// Standings / Leaderboard
// ============================================

export async function getBracketStandings(
  leagueId: string
): Promise<
  { user_id: string; username: string; display_name: string | null; total_points: number }[]
> {
  const { data, error } = await supabase.rpc('get_bracket_standings', {
    p_league_id: leagueId,
  });

  if (error) throw error;
  return data ?? [];
}

export async function getSurvivorPoolStandings(
  leagueId: string
): Promise<
  {
    user_id: string;
    username: string;
    display_name: string | null;
    is_alive: boolean;
    eliminated_in_episode: number | null;
  }[]
> {
  const { data, error } = await supabase.rpc('get_survivor_pool_standings', {
    p_league_id: leagueId,
  });

  if (error) throw error;
  return data ?? [];
}

export async function deleteLeague(leagueId: string): Promise<void> {
  const { error } = await supabase
    .from('leagues')
    .delete()
    .eq('id', leagueId);
  if (error) throw new Error(error.message);
}

// ============================================
// Announcements
// ============================================

export type Announcement = {
  id: string;
  message: string;
  link_text: string | null;
  link_url: string | null;
};

export async function getActiveAnnouncement(): Promise<Announcement | null> {
  const { data, error } = await supabase
    .from('announcements')
    .select('id, message, link_text, link_url')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// ============================================
// Helpers
// ============================================

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

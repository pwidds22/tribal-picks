import { supabase } from './client';
import type {
  Season,
  Castaway,
  League,
  LeagueMember,
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
  isPublic: boolean = false
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
): Promise<LeagueMember> {
  const { data, error } = await supabase
    .from('league_members')
    .insert({ league_id: leagueId, user_id: userId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function joinLeagueByCode(
  inviteCode: string,
  userId: string
): Promise<League> {
  const { data: league, error } = await supabase
    .from('leagues')
    .select('*')
    .eq('invite_code', inviteCode.toUpperCase())
    .single();

  if (error || !league) throw new Error('League not found. Check the invite code.');

  await joinLeague(league.id, userId);
  return league;
}

export async function getUserLeagues(userId: string): Promise<League[]> {
  const { data, error } = await supabase
    .from('league_members')
    .select('league_id, leagues(*)')
    .eq('user_id', userId);

  if (error) throw error;
  return (data ?? []).map((d: any) => d.leagues).filter(Boolean);
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
  return (data ?? []).map((d: any) => ({
    user_id: d.user_id,
    username: d.profiles?.username ?? 'Unknown',
    display_name: d.profiles?.display_name,
  }));
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
  castawayId: number
): Promise<void> {
  const { error } = await supabase.from('survivor_pool_picks').upsert(
    {
      league_id: leagueId,
      user_id: userId,
      episode_id: episodeId,
      picked_castaway_id: castawayId,
    },
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
        username: (d as any).profiles?.username ?? 'Unknown',
      });
    }
  }

  return Array.from(userMap.entries()).map(([user_id, v]) => ({
    user_id,
    ...v,
  }));
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

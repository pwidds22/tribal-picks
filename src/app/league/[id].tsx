import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import {
  getLeague,
  getBracketStandings,
  getSurvivorPoolStandings,
} from '../../services/supabase/queries';
import {
  assignBracketRanks,
  assignSurvivorPoolRanks,
} from '../../core/standings';
import { useAuthStore } from '../../stores/useAuthStore';
import Leaderboard from '../../components/Leaderboard';
import type {
  League,
  LeaderboardEntry,
  SurvivorPoolStandingEntry,
} from '../../core/types';

export default function LeagueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const [league, setLeague] = useState<League | null>(null);
  const [bracketStandings, setBracketStandings] = useState<LeaderboardEntry[]>(
    []
  );
  const [poolStandings, setPoolStandings] = useState<
    SurvivorPoolStandingEntry[]
  >([]);
  const [memberCount, setMemberCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    loadLeague();
  }, [id]);

  const loadLeague = async () => {
    try {
      const leagueData = await getLeague(id!);
      setLeague(leagueData);

      if (!leagueData) return;

      if (leagueData.game_type === 'bracket') {
        const raw = await getBracketStandings(id!);
        const ranked = assignBracketRanks(raw);
        setBracketStandings(ranked);
        setMemberCount(ranked.length);
      } else if (leagueData.game_type === 'survivor_pool') {
        const raw = await getSurvivorPoolStandings(id!);
        const ranked = assignSurvivorPoolRanks(raw);
        setPoolStandings(ranked);
        setMemberCount(ranked.length);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleShare = async () => {
    if (!league) return;
    await Share.share({
      message: `Join my Tribal Picks league "${league.name}"! Use invite code: ${league.invite_code}`,
    });
  };

  const handlePlay = () => {
    if (!league) return;
    if (league.game_type === 'bracket') {
      router.push(`/game/bracket?leagueId=${league.id}`);
    } else if (league.game_type === 'survivor_pool') {
      router.push(`/game/pool?leagueId=${league.id}`);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    );
  }

  if (!league) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>League not found</Text>
      </View>
    );
  }

  const gameTypeLabel =
    league.game_type === 'bracket'
      ? 'Elimination Bracket'
      : league.game_type === 'survivor_pool'
        ? 'Survivor Pool'
        : league.game_type;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.leagueName}>{league.name}</Text>
        <Text style={styles.gameType}>{gameTypeLabel}</Text>
        <View style={styles.codeRow}>
          <Text style={styles.codeLabel}>Invite Code:</Text>
          <Text style={styles.code}>{league.invite_code}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.playButton} onPress={handlePlay}>
          <Text style={styles.playButtonText}>Make Picks</Text>
        </Pressable>
        <Pressable style={styles.shareButton} onPress={handleShare}>
          <Text style={styles.shareButtonText}>Invite Friends</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Standings ({memberCount})</Text>

      {league.game_type === 'bracket' ? (
        <Leaderboard
          gameType="bracket"
          entries={bracketStandings}
          currentUserId={user?.id ?? null}
        />
      ) : league.game_type === 'survivor_pool' ? (
        <Leaderboard
          gameType="survivor_pool"
          entries={poolStandings}
          currentUserId={user?.id ?? null}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0f23',
  },
  errorText: {
    color: '#ff4757',
    fontSize: 16,
  },
  header: {
    padding: 20,
    backgroundColor: '#1a1a2e',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e',
  },
  leagueName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  gameType: {
    fontSize: 14,
    color: '#e94560',
    fontWeight: '600',
    marginBottom: 12,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  codeLabel: {
    color: '#a0a0a0',
    fontSize: 14,
  },
  code: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 3,
    backgroundColor: '#0f0f23',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
  },
  playButton: {
    flex: 1,
    backgroundColor: '#e94560',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  playButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  shareButton: {
    flex: 1,
    backgroundColor: '#16213e',
    borderWidth: 1,
    borderColor: '#e94560',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  shareButtonText: {
    color: '#e94560',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
});

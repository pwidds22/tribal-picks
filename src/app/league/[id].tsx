import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Share,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
import { useLeagueStore } from '../../stores/useLeagueStore';
import Leaderboard from '../../components/Leaderboard';
import type {
  League,
  LeaderboardEntry,
  SurvivorPoolStandingEntry,
} from '../../core/types';

export default function LeagueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const authReady = useAuthStore((s) => s.authReady);
  const deleteLeague = useLeagueStore((s) => s.deleteLeague);
  // Pull cached league from the persisted leagues store for instant display
  const cachedLeague = useLeagueStore((s) => s.leagues.find((l) => l.id === id));
  const [league, setLeague] = useState<League | null>(cachedLeague ?? null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [bracketStandings, setBracketStandings] = useState<LeaderboardEntry[]>(
    []
  );
  const [poolStandings, setPoolStandings] = useState<
    SurvivorPoolStandingEntry[]
  >([]);
  const [memberCount, setMemberCount] = useState(0);
  // Start as not-loading if we have cached league data to show
  const [isLoading, setIsLoading] = useState(!cachedLeague);

  // Only fetch fresh data from the server once the auth token is valid.
  // On cold start authReady is false until refreshSession() completes,
  // so we show cached league info instantly and load standings once ready.
  useEffect(() => {
    if (!id || !authReady) return;
    loadLeague();
  }, [id, authReady]);

  const loadLeague = async () => {
    // If we already have cached data, don't show full-screen spinner —
    // just load standings in the background
    if (!league) setIsLoading(true);
    try {
      const leagueData = await getLeague(id!);
      setLeague(leagueData);

      if (!leagueData) {
        setIsLoading(false);
        return;
      }

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
    } catch {
      Alert.alert('Error', 'Failed to load league data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!league) return;
    await Share.share({ message: league.invite_code });
  };

  const handleShare = async () => {
    if (!league) return;
    await Share.share({
      message: `Join my Tribal Picks league "${league.name}"!\n\nUse code: ${league.invite_code}\n\nOr tap to join: tribal-picks://join/${league.invite_code}`,
    });
  };

  const handleViewUserPicks = (userId: string, displayName: string) => {
    if (!league) return;
    router.push({
      pathname: '/game/user-picks',
      params: {
        leagueId: league.id,
        userId,
        userName: displayName,
        gameType: league.game_type,
      },
    } as never);
  };

  const handlePlay = () => {
    if (!league) return;
    if (league.game_type === 'bracket') {
      router.push(`/game/bracket?leagueId=${league.id}`);
    } else if (league.game_type === 'survivor_pool') {
      router.push(`/game/pool?leagueId=${league.id}`);
    }
  };

  const handleDeleteLeague = () => {
    Alert.alert(
      'Delete League',
      'Are you sure? This cannot be undone. All members, picks, and standings will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await deleteLeague(id!);
              router.replace('/(tabs)/leagues');
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete league.');
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  const isCommissioner = user?.id === league?.commissioner_id;

  // Full-screen spinner only if we have NO cached league data at all
  if (isLoading && !league) {
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

  // Whether standings are still loading (cached league showing, server fetch pending)
  const standingsLoading = isLoading || !authReady;

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
        {league.start_episode > 1 && (
          <Text style={styles.startEpisode}>
            Starting from Episode {league.start_episode}
          </Text>
        )}
        <View style={styles.codeRow}>
          <Text style={styles.codeLabel}>Invite Code:</Text>
          <Pressable onPress={handleCopyCode} style={styles.codeButton}>
            <Text style={styles.code}>{league.invite_code}</Text>
            <Ionicons name="share-outline" size={18} color="#a0a0a0" />
          </Pressable>
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

      <Text style={styles.sectionTitle}>
        Standings{standingsLoading ? '' : ` (${memberCount})`}
      </Text>

      {standingsLoading ? (
        <View style={styles.standingsLoading}>
          <ActivityIndicator size="small" color="#e94560" />
          <Text style={styles.standingsLoadingText}>Loading standings…</Text>
        </View>
      ) : league.game_type === 'bracket' ? (
        <Leaderboard
          gameType="bracket"
          entries={bracketStandings}
          currentUserId={user?.id ?? null}
          onPressUser={handleViewUserPicks}
        />
      ) : league.game_type === 'survivor_pool' ? (
        <Leaderboard
          gameType="survivor_pool"
          entries={poolStandings}
          currentUserId={user?.id ?? null}
          onPressUser={handleViewUserPicks}
        />
      ) : null}

      {isCommissioner && (
        <Pressable
          style={styles.deleteButton}
          onPress={handleDeleteLeague}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.deleteButtonText}>Delete League</Text>
          )}
        </Pressable>
      )}
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
  startEpisode: {
    fontSize: 12,
    color: '#a0a0a0',
    marginTop: -8,
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
  codeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0f0f23',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  code: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 3,
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
  standingsLoading: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  standingsLoadingText: {
    color: '#a0a0a0',
    fontSize: 14,
  },
  deleteButton: {
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 40,
    backgroundColor: '#ff4757',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

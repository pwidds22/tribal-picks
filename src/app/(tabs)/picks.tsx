import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '../../stores/useAuthStore';
import { useLeagueStore } from '../../stores/useLeagueStore';
import { useSeasonStore } from '../../stores/useSeasonStore';
import { getBracketPicks, getSurvivorPoolPicks } from '../../services/supabase/queries';
import { isBracketLocked, isEpisodeLocked } from '../../core/locks';
import PickStatusCard from '../../components/PickStatusCard';
import AuthPrompt from '../../components/AuthPrompt';
import type { GameType } from '../../core/types';

type PickStatus = {
  leagueId: string;
  leagueName: string;
  gameType: GameType;
  status: 'action_needed' | 'submitted' | 'locked';
  statusLabel: string;
};

export default function PicksScreen() {
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.isLoading);
  const { leagues, fetchLeagues } = useLeagueStore();
  const { season, nextEpisode, fetchSeason } = useSeasonStore();
  const [pickStatuses, setPickStatuses] = useState<PickStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchLeagues(user.id);
      fetchSeason();
    }
  }, [user]);

  useEffect(() => {
    if (!user || !leagues.length) {
      setPickStatuses([]);
      setIsLoading(false);
      return;
    }
    checkPickStatuses();
  }, [user, leagues, season, nextEpisode]);

  const checkPickStatuses = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const statuses = await Promise.all(
        leagues
          .filter((l) => l.game_type === 'bracket' || l.game_type === 'survivor_pool')
          .map(async (league): Promise<PickStatus> => {
            if (league.game_type === 'bracket') {
              const locked = isBracketLocked(season?.premiere_date ?? null);
              if (locked) {
                return {
                  leagueId: league.id,
                  leagueName: league.name,
                  gameType: league.game_type,
                  status: 'locked',
                  statusLabel: 'Bracket locked',
                };
              }
              const picks = await getBracketPicks(league.id, user.id);
              return {
                leagueId: league.id,
                leagueName: league.name,
                gameType: league.game_type,
                status: picks.length > 0 ? 'submitted' : 'action_needed',
                statusLabel: picks.length > 0 ? 'Bracket submitted' : 'Set your bracket',
              };
            }

            // survivor_pool
            const locked = isEpisodeLocked(nextEpisode?.air_date ?? null);
            if (locked && !nextEpisode) {
              return {
                leagueId: league.id,
                leagueName: league.name,
                gameType: league.game_type,
                status: 'locked',
                statusLabel: 'No upcoming episode',
              };
            }
            if (locked) {
              return {
                leagueId: league.id,
                leagueName: league.name,
                gameType: league.game_type,
                status: 'locked',
                statusLabel: `Ep ${nextEpisode!.number} locked`,
              };
            }
            if (nextEpisode) {
              const picks = await getSurvivorPoolPicks(league.id, user.id);
              const hasPick = picks.some((p) => p.episode_id === nextEpisode.id);
              return {
                leagueId: league.id,
                leagueName: league.name,
                gameType: league.game_type,
                status: hasPick ? 'submitted' : 'action_needed',
                statusLabel: hasPick
                  ? `Ep ${nextEpisode.number} pick submitted`
                  : `Pick for Ep ${nextEpisode.number}`,
              };
            }
            return {
              leagueId: league.id,
              leagueName: league.name,
              gameType: league.game_type,
              status: 'locked',
              statusLabel: 'No upcoming episode',
            };
          })
      );

      setPickStatuses(statuses);
    } catch (err) {
      console.error('Failed to check pick statuses:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePress = (item: PickStatus) => {
    if (item.gameType === 'bracket') {
      router.push(`/game/bracket?leagueId=${item.leagueId}`);
    } else {
      router.push(`/game/pool?leagueId=${item.leagueId}`);
    }
  };

  if (!user && !authLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <AuthPrompt message="Sign in to track your picks" />
      </SafeAreaView>
    );
  }

  if (isLoading && !pickStatuses.length) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>My Picks</Text>
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#e94560" />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={pickStatuses}
        keyExtractor={(item) => item.leagueId}
        renderItem={({ item }) => (
          <PickStatusCard
            leagueName={item.leagueName}
            status={item.status}
            statusLabel={item.statusLabel}
            onPress={() => handlePress(item)}
          />
        )}
        ListHeaderComponent={() => (
          <Text style={styles.title}>My Picks</Text>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No active picks</Text>
            <Text style={styles.emptySubtext}>
              Join a league to start making picks for each episode
            </Text>
            <Pressable
              style={styles.joinButton}
              onPress={() => router.push('/league/join')}
            >
              <Text style={styles.joinButtonText}>Join a League</Text>
            </Pressable>
          </View>
        )}
        contentContainerStyle={styles.content}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  content: {
    padding: 20,
    flexGrow: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 20,
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#ffffff',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#a0a0a0',
    textAlign: 'center',
    marginBottom: 24,
  },
  joinButton: {
    backgroundColor: '#e94560',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  joinButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

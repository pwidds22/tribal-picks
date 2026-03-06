import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getBracketPicks,
  getUserPoolPickHistory,
  getCastaways,
  getLeague,
  getEpisodes,
} from '../../services/supabase/queries';
import { isEpisodeLocked } from '../../core/locks';
import type { BracketPick, Castaway, League } from '../../core/types';

type PoolPickRow = {
  episode_number: number;
  castaway_name: string;
  is_alive: boolean;
};

export default function UserPicksScreen() {
  const params = useLocalSearchParams<{
    leagueId: string;
    userId: string;
    userName: string;
    gameType: string;
  }>();
  const { leagueId, userId, userName, gameType } = params;

  const [loading, setLoading] = useState(true);
  const [bracketPicks, setBracketPicks] = useState<(BracketPick & { castaway_name: string })[]>([]);
  const [poolHistory, setPoolHistory] = useState<PoolPickRow[]>([]);
  const [league, setLeague] = useState<League | null>(null);

  useEffect(() => {
    loadData();
  }, [leagueId, userId, gameType]);

  async function loadData() {
    if (!leagueId || !userId) return;
    setLoading(true);
    try {
      const leagueData = await getLeague(leagueId);
      setLeague(leagueData);

      if (gameType === 'bracket') {
        const [picks, castaways] = await Promise.all([
          getBracketPicks(leagueId, userId),
          leagueData ? getCastaways(leagueData.season_id) : Promise.resolve([]),
        ]);
        const castawayMap = new Map(castaways.map((c: Castaway) => [c.id, c.name]));
        setBracketPicks(
          picks.map((p) => ({
            ...p,
            castaway_name: castawayMap.get(p.castaway_id) ?? 'Unknown',
          }))
        );
      } else {
        const [history, episodes] = await Promise.all([
          getUserPoolPickHistory(leagueId, userId),
          leagueData ? getEpisodes(leagueData.season_id) : Promise.resolve([]),
        ]);
        // Build a map of episode_number → air_date for lock checking
        const episodeAirDateMap = new Map(
          episodes.map((ep) => [ep.number, ep.air_date])
        );
        // Only show picks for episodes that have already aired (locked)
        const lockedPicks = history.filter((pick) => {
          const airDate = episodeAirDateMap.get(pick.episode_number);
          return airDate ? isEpisodeLocked(airDate) : false;
        });
        setPoolHistory(lockedPicks);
      }
    } catch {
      // Fail silently — empty state will show
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#e94560" />
        </View>
      </SafeAreaView>
    );
  }

  const displayName = userName || 'Player';

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Ionicons name="person-circle-outline" size={40} color="#e94560" />
        <View style={styles.headerText}>
          <Text style={styles.playerName}>{displayName}</Text>
          <Text style={styles.gameLabel}>
            {gameType === 'bracket' ? 'Elimination Bracket' : 'Survivor Pool'} Picks
          </Text>
        </View>
      </View>

      {gameType === 'bracket' ? (
        <BracketPicksList picks={bracketPicks} />
      ) : (
        <PoolPicksList picks={poolHistory} />
      )}
    </SafeAreaView>
  );
}

function BracketPicksList({
  picks,
}: {
  picks: (BracketPick & { castaway_name: string })[];
}) {
  if (picks.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No bracket picks submitted yet</Text>
      </View>
    );
  }

  const totalCastaways = picks.length;

  return (
    <FlatList
      data={picks}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={
        <View style={styles.listHeader}>
          <Text style={[styles.headerCell, styles.posCol]}>Boot #</Text>
          <Text style={[styles.headerCell, styles.nameCol]}>Castaway</Text>
          <Text style={[styles.headerCell, styles.ptsCol]}>Pts</Text>
        </View>
      }
      renderItem={({ item }) => {
        const label = item.predicted_position === totalCastaways
          ? 'Winner'
          : `#${item.predicted_position}`;
        const isWinner = item.predicted_position === totalCastaways;

        return (
          <View style={[styles.row, isWinner && styles.winnerRow]}>
            <Text style={[styles.posText, isWinner && styles.winnerText]}>
              {label}
            </Text>
            <Text
              style={[styles.castName, isWinner && styles.winnerText]}
              numberOfLines={1}
            >
              {item.castaway_name}
            </Text>
            <Text style={[styles.ptsText, item.points > 0 && styles.pointsPositive]}>
              {item.points}
            </Text>
          </View>
        );
      }}
    />
  );
}

function PoolPicksList({ picks }: { picks: PoolPickRow[] }) {
  if (picks.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No pool picks yet</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={picks}
      keyExtractor={(_, i) => String(i)}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={
        <View style={styles.listHeader}>
          <Text style={[styles.headerCell, styles.posCol]}>Ep.</Text>
          <Text style={[styles.headerCell, styles.nameCol]}>Pick</Text>
          <Text style={[styles.headerCell, styles.ptsCol]}>Result</Text>
        </View>
      }
      renderItem={({ item }) => {
        const survived = item.is_alive;
        return (
          <View style={styles.row}>
            <Text style={styles.posText}>Ep {item.episode_number}</Text>
            <Text style={styles.castName} numberOfLines={1}>
              {item.castaway_name}
            </Text>
            <View style={styles.resultBadge}>
              <Ionicons
                name={survived ? 'checkmark-circle' : 'close-circle'}
                size={18}
                color={survived ? '#2ed573' : '#ff4757'}
              />
              <Text style={[styles.resultText, { color: survived ? '#2ed573' : '#ff4757' }]}>
                {survived ? 'Safe' : 'Out'}
              </Text>
            </View>
          </View>
        );
      }}
    />
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e',
    backgroundColor: '#1a1a2e',
  },
  headerText: {
    marginLeft: 12,
  },
  playerName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  gameLabel: {
    fontSize: 13,
    color: '#a0a0a0',
    marginTop: 2,
  },
  listContent: {
    paddingBottom: 40,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e',
    backgroundColor: '#1a1a2e',
  },
  headerCell: {
    color: '#a0a0a0',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  posCol: {
    width: 60,
  },
  nameCol: {
    flex: 1,
  },
  ptsCol: {
    width: 60,
    textAlign: 'right',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  winnerRow: {
    backgroundColor: '#1a2a1e',
    borderLeftWidth: 3,
    borderLeftColor: '#ffd700',
  },
  posText: {
    color: '#e94560',
    fontSize: 14,
    fontWeight: 'bold',
    width: 60,
  },
  castName: {
    color: '#ffffff',
    fontSize: 15,
    flex: 1,
  },
  ptsText: {
    color: '#666',
    fontSize: 14,
    width: 60,
    textAlign: 'right',
  },
  pointsPositive: {
    color: '#2ed573',
    fontWeight: 'bold',
  },
  winnerText: {
    color: '#ffd700',
  },
  resultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 60,
    justifyContent: 'flex-end',
    gap: 4,
  },
  resultText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyText: {
    color: '#a0a0a0',
    fontSize: 16,
    textAlign: 'center',
  },
});

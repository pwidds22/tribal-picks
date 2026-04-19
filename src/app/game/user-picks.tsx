import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getBracketPicks,
  getUserPoolPickHistory,
  getBracketStandings,
  getBracketEpisodeScores,
  getCastaways,
  getLeague,
  getEpisodes,
} from '../../services/supabase/queries';
import { useAuthStore } from '../../stores/useAuthStore';
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
  const authReady = useAuthStore((s) => s.authReady);

  const [loading, setLoading] = useState(true);
  const [bracketPicks, setBracketPicks] = useState<(BracketPick & { castaway_name: string; is_eliminated: boolean; elimination_order: number | null })[]>([]);
  const [bracketTotalPoints, setBracketTotalPoints] = useState<number>(0);
  const [episodeScores, setEpisodeScores] = useState<{ episode_number: number; episode_score: number }[]>([]);
  const [poolHistory, setPoolHistory] = useState<PoolPickRow[]>([]);
  const [league, setLeague] = useState<League | null>(null);

  // Wait for auth token to be refreshed before hitting Supabase
  useEffect(() => {
    if (!authReady) return;
    loadData();
  }, [leagueId, userId, gameType, authReady]);

  async function loadData() {
    if (!leagueId || !userId) return;
    setLoading(true);
    try {
      const leagueData = await getLeague(leagueId);
      setLeague(leagueData);

      if (gameType === 'bracket') {
        const [picks, castaways, standings, epScores] = await Promise.all([
          getBracketPicks(leagueId, userId),
          leagueData ? getCastaways(leagueData.season_id) : Promise.resolve([]),
          getBracketStandings(leagueId),
          getBracketEpisodeScores(leagueId, userId),
        ]);
        setEpisodeScores(epScores);
        const castawayMap = new Map(castaways.map((c: Castaway) => [c.id, c]));
        setBracketPicks(
          picks.map((p) => {
            const castaway = castawayMap.get(p.castaway_id);
            return {
              ...p,
              castaway_name: castaway?.name ?? 'Unknown',
              is_eliminated: castaway?.is_eliminated ?? false,
              elimination_order: castaway?.elimination_order ?? null,
            };
          })
        );
        // Get this user's total score from standings
        const userStanding = standings.find((s) => s.user_id === userId);
        setBracketTotalPoints(userStanding?.total_points ?? 0);
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
        <BracketPicksList picks={bracketPicks} totalPoints={bracketTotalPoints} episodeScores={episodeScores} />
      ) : (
        <PoolPicksList picks={poolHistory} />
      )}
    </SafeAreaView>
  );
}

function BracketPicksList({
  picks,
  totalPoints,
  episodeScores,
}: {
  picks: (BracketPick & { castaway_name: string; is_eliminated: boolean; elimination_order: number | null })[];
  totalPoints: number;
  episodeScores: { episode_number: number; episode_score: number }[];
}) {
  const [expandedEp, setExpandedEp] = useState<number | null>(null);

  if (picks.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No bracket picks submitted yet</Text>
      </View>
    );
  }

  const winnerPosition = Math.max(...picks.map((p) => p.predicted_position));

  // For each episode, find which castaways the user predicted would still be in
  // and which of those were actually correct. Uses brute-force over totalElims
  // to match the stored score (correct = score / episode_number).
  function getEpisodeBreakdown(epNumber: number, epScore: number) {
    const correct = epNumber > 0 ? Math.round(epScore / epNumber) : 0;

    for (let totalElims = 0; totalElims <= picks.length; totalElims++) {
      const predictedStillIn = picks.filter((p) => p.predicted_position > totalElims);
      const actuallyCorrect = predictedStillIn.filter((p) => {
        if (!p.is_eliminated) return true;
        if (p.elimination_order == null) return true;
        return p.elimination_order > totalElims;
      });
      if (actuallyCorrect.length === correct) {
        return {
          correct,
          correctPicks: actuallyCorrect.map((p) => p.castaway_name),
          incorrectPicks: predictedStillIn
            .filter((p) => !actuallyCorrect.includes(p))
            .map((p) => p.castaway_name),
        };
      }
    }
    return { correct, correctPicks: [] as string[], incorrectPicks: [] as string[] };
  }

  return (
    <FlatList
      data={[
        { type: 'header' as const },
        ...episodeScores.map((es) => ({ type: 'episode' as const, data: es })),
        { type: 'picks-header' as const },
        ...picks.map((p) => ({ type: 'pick' as const, data: p })),
      ]}
      keyExtractor={(item, i) => `${item.type}-${i}`}
      contentContainerStyle={styles.listContent}
      renderItem={({ item }) => {
        if (item.type === 'header') {
          return (
            <View>
              <View style={styles.totalScoreBar}>
                <Text style={styles.totalScoreLabel}>Total Score</Text>
                <Text style={styles.totalScoreValue}>{totalPoints} pts</Text>
              </View>
              {episodeScores.length > 0 && (
                <View style={styles.sectionTitleBar}>
                  <Text style={styles.sectionTitle}>Score Breakdown</Text>
                  <Text style={styles.sectionHint}>Tap an episode for details</Text>
                </View>
              )}
            </View>
          );
        }

        if (item.type === 'episode') {
          const es = item.data;
          const correct = es.episode_number > 0
            ? Math.round(es.episode_score / es.episode_number)
            : 0;
          const isExpanded = expandedEp === es.episode_number;
          const breakdown = isExpanded
            ? getEpisodeBreakdown(es.episode_number, es.episode_score)
            : null;

          return (
            <Pressable
              onPress={() => setExpandedEp(isExpanded ? null : es.episode_number)}
            >
              <View style={styles.episodeScoreRow}>
                <Text style={styles.episodeLabel}>Ep {es.episode_number}</Text>
                <Text style={styles.episodeFormula}>
                  {correct} correct × {es.episode_number}
                </Text>
                <Text style={styles.episodePoints}>{es.episode_score}</Text>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color="#666"
                  style={{ marginLeft: 6 }}
                />
              </View>
              {isExpanded && breakdown && (
                <View style={styles.episodeDetail}>
                  {breakdown.correctPicks.length > 0 && (
                    <View style={styles.detailGroup}>
                      <Text style={styles.detailLabel}>
                        Correct ({breakdown.correctPicks.length})
                      </Text>
                      <Text style={styles.detailNames}>
                        {breakdown.correctPicks.join(', ')}
                      </Text>
                    </View>
                  )}
                  {breakdown.incorrectPicks.length > 0 && (
                    <View style={styles.detailGroup}>
                      <Text style={[styles.detailLabel, { color: '#ff4757' }]}>
                        Wrong ({breakdown.incorrectPicks.length})
                      </Text>
                      <Text style={[styles.detailNames, { color: '#ff4757' }]}>
                        {breakdown.incorrectPicks.join(', ')}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </Pressable>
          );
        }

        if (item.type === 'picks-header') {
          return (
            <View>
              <View style={styles.sectionTitleBar}>
                <Text style={styles.sectionTitle}>Bracket Picks</Text>
              </View>
              <View style={styles.listHeader}>
                <Text style={[styles.headerCell, styles.posCol]}>Boot #</Text>
                <Text style={[styles.headerCell, styles.nameCol]}>Castaway</Text>
                <Text style={[styles.headerCell, styles.ptsCol]}>Status</Text>
              </View>
            </View>
          );
        }

        // type === 'pick'
        const pick = item.data;
        const isWinner = pick.predicted_position === winnerPosition;
        const label = isWinner ? 'Winner' : `#${pick.predicted_position}`;

        let statusText: string;
        let statusColor: string;
        if (pick.is_eliminated) {
          statusText = pick.elimination_order
            ? `Out #${pick.elimination_order}`
            : 'Out';
          statusColor = '#ff4757';
        } else {
          statusText = 'Still In';
          statusColor = '#2ed573';
        }

        return (
          <View style={[styles.row, isWinner && styles.winnerRow]}>
            <Text style={[styles.posText, isWinner && styles.winnerText]}>
              {label}
            </Text>
            <Text
              style={[styles.castName, isWinner && styles.winnerText]}
              numberOfLines={1}
            >
              {pick.castaway_name}
            </Text>
            <Text style={[styles.ptsText, { color: statusColor }]}>
              {statusText}
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
  totalScoreBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#1a1a2e',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e',
  },
  totalScoreLabel: {
    color: '#a0a0a0',
    fontSize: 14,
    fontWeight: '600',
  },
  totalScoreValue: {
    color: '#e94560',
    fontSize: 18,
    fontWeight: 'bold',
  },
  sectionTitleBar: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#16213e',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e',
  },
  sectionTitle: {
    color: '#e94560',
    fontSize: 13,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionHint: {
    color: '#666',
    fontSize: 11,
    marginTop: 2,
  },
  episodeScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  episodeLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    width: 50,
  },
  episodeFormula: {
    color: '#a0a0a0',
    fontSize: 13,
    flex: 1,
  },
  episodePoints: {
    color: '#2ed573',
    fontSize: 14,
    fontWeight: 'bold',
    width: 50,
    textAlign: 'right',
  },
  episodeDetail: {
    backgroundColor: '#16213e',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  detailGroup: {
    marginBottom: 6,
  },
  detailLabel: {
    color: '#2ed573',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  detailNames: {
    color: '#a0a0a0',
    fontSize: 12,
    lineHeight: 18,
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

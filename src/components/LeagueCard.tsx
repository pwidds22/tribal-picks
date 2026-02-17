import { Text, Pressable, StyleSheet } from 'react-native';
import type { League, GameType } from '../core/types';

const GAME_TYPE_LABELS: Record<GameType, string> = {
  bracket: 'Elimination Bracket',
  draft: 'Cast Draft',
  weekly: "Weekly Pick'em",
  survivor_pool: 'Survivor Pool',
};

const GAME_TYPE_COLORS: Record<GameType, string> = {
  bracket: '#e94560',
  draft: '#4ecdc4',
  weekly: '#ffa502',
  survivor_pool: '#2ed573',
};

type Props = {
  league: League;
  onPress: () => void;
};

export default function LeagueCard({ league, onPress }: Props) {
  const color = GAME_TYPE_COLORS[league.game_type] ?? '#e94560';
  return (
    <Pressable style={[styles.card, { borderLeftColor: color }]} onPress={onPress}>
      <Text style={styles.name}>{league.name}</Text>
      <Text style={[styles.gameType, { color }]}>
        {GAME_TYPE_LABELS[league.game_type] ?? league.game_type}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  name: { color: '#ffffff', fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  gameType: { fontSize: 13, fontWeight: '600' },
});

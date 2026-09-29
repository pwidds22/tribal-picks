import { Text, Pressable, StyleSheet } from 'react-native';
import type { League } from '../core/types';
import { GAME_TYPE_META } from '../core/gameTypes';

type Props = {
  league: League;
  /** Set for past-season leagues so they read as archived. */
  seasonNumber?: number | null;
  onPress: () => void;
};

export default function LeagueCard({ league, seasonNumber = null, onPress }: Props) {
  const meta = GAME_TYPE_META[league.game_type];
  const color = seasonNumber != null ? '#666' : meta?.accentColor ?? '#e94560';
  return (
    <Pressable style={[styles.card, { borderLeftColor: color }]} onPress={onPress}>
      <Text style={styles.name}>{league.name}</Text>
      <Text style={[styles.gameType, { color }]}>
        {meta?.label ?? league.game_type}
        {seasonNumber != null ? ` • Season ${seasonNumber}` : ''}
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

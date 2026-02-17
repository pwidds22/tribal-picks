import { View, Text, Pressable, StyleSheet } from 'react-native';

type Props = {
  leagueName: string;
  status: 'action_needed' | 'submitted' | 'locked';
  statusLabel: string;
  onPress: () => void;
};

export default function PickStatusCard({
  leagueName,
  status,
  statusLabel,
  onPress,
}: Props) {
  const statusColor =
    status === 'action_needed'
      ? '#ffa502'
      : status === 'submitted'
        ? '#2ed573'
        : '#a0a0a0';

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.row}>
        <View style={styles.info}>
          <Text style={styles.name}>{leagueName}</Text>
          <Text style={[styles.status, { color: statusColor }]}>{statusLabel}</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  info: { flex: 1 },
  name: { color: '#ffffff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  status: { fontSize: 13, fontWeight: '600' },
  arrow: { color: '#a0a0a0', fontSize: 24, fontWeight: 'bold' },
});

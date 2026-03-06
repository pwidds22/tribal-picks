import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type {
  LeaderboardEntry,
  SurvivorPoolStandingEntry,
} from '../core/types';

type Props =
  | {
      gameType: 'bracket';
      entries: LeaderboardEntry[];
      currentUserId: string | null;
      onPressUser?: (userId: string, displayName: string) => void;
    }
  | {
      gameType: 'survivor_pool';
      entries: SurvivorPoolStandingEntry[];
      currentUserId: string | null;
      onPressUser?: (userId: string, displayName: string) => void;
    };

export default function Leaderboard(props: Props) {
  const { gameType, currentUserId, onPressUser } = props;

  if (gameType === 'bracket') {
    return (
      <FlatList
        data={props.entries}
        keyExtractor={(item) => item.user_id}
        ListHeaderComponent={<BracketHeader />}
        renderItem={({ item }) => (
          <BracketRow
            entry={item}
            isCurrentUser={item.user_id === currentUserId}
            onPress={onPressUser}
          />
        )}
        ListEmptyComponent={<EmptyState />}
      />
    );
  }

  return (
    <FlatList
      data={props.entries}
      keyExtractor={(item) => item.user_id}
      ListHeaderComponent={<PoolHeader />}
      renderItem={({ item }) => (
        <PoolRow
          entry={item}
          isCurrentUser={item.user_id === currentUserId}
          onPress={onPressUser}
        />
      )}
      ListEmptyComponent={<EmptyState />}
    />
  );
}

function BracketHeader() {
  return (
    <View style={styles.headerRow}>
      <Text style={[styles.headerCell, styles.rankCol]}>#</Text>
      <Text style={[styles.headerCell, styles.nameCol]}>Player</Text>
      <Text style={[styles.headerCell, styles.scoreCol]}>Points</Text>
    </View>
  );
}

function BracketRow({
  entry,
  isCurrentUser,
  onPress,
}: {
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
  onPress?: (userId: string, displayName: string) => void;
}) {
  const displayName = entry.display_name ?? entry.username;
  const content = (
    <>
      <Text style={[styles.rank, isCurrentUser && styles.currentUserText]}>
        {entry.rank}
      </Text>
      <View style={styles.nameContainer}>
        <Text
          style={[styles.name, isCurrentUser && styles.currentUserText]}
          numberOfLines={1}
        >
          {displayName}
        </Text>
        {isCurrentUser && <Text style={styles.youBadge}>You</Text>}
        {onPress && (
          <Ionicons name="chevron-forward" size={14} color="#555" />
        )}
      </View>
      <Text style={[styles.score, isCurrentUser && styles.currentUserText]}>
        {entry.total_points}
      </Text>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.row,
          isCurrentUser && styles.currentUserRow,
          pressed && styles.rowPressed,
        ]}
        onPress={() => onPress(entry.user_id, displayName)}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={[styles.row, isCurrentUser && styles.currentUserRow]}>
      {content}
    </View>
  );
}

function PoolHeader() {
  return (
    <View style={styles.headerRow}>
      <Text style={[styles.headerCell, styles.rankCol]}>#</Text>
      <Text style={[styles.headerCell, styles.nameCol]}>Player</Text>
      <Text style={[styles.headerCell, styles.statusCol]}>Status</Text>
    </View>
  );
}

function PoolRow({
  entry,
  isCurrentUser,
  onPress,
}: {
  entry: SurvivorPoolStandingEntry;
  isCurrentUser: boolean;
  onPress?: (userId: string, displayName: string) => void;
}) {
  const statusText = entry.is_alive
    ? 'ALIVE'
    : `Out Ep. ${entry.eliminated_in_episode ?? '?'}`;
  const statusColor = entry.is_alive ? '#2ed573' : '#ff4757';
  const displayName = entry.display_name ?? entry.username;

  const content = (
    <>
      <Text style={[styles.rank, isCurrentUser && styles.currentUserText]}>
        {entry.rank}
      </Text>
      <View style={styles.nameContainer}>
        <Text
          style={[
            styles.name,
            isCurrentUser && styles.currentUserText,
            !entry.is_alive && styles.dimmedText,
          ]}
          numberOfLines={1}
        >
          {displayName}
        </Text>
        {isCurrentUser && <Text style={styles.youBadge}>You</Text>}
        {onPress && (
          <Ionicons name="chevron-forward" size={14} color="#555" />
        )}
      </View>
      <Text style={[styles.statusText, { color: statusColor }]}>
        {statusText}
      </Text>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.row,
          isCurrentUser && styles.currentUserRow,
          !entry.is_alive && styles.eliminatedRow,
          pressed && styles.rowPressed,
        ]}
        onPress={() => onPress(entry.user_id, displayName)}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.row,
        isCurrentUser && styles.currentUserRow,
        !entry.is_alive && styles.eliminatedRow,
      ]}
    >
      {content}
    </View>
  );
}

function EmptyState() {
  return <Text style={styles.emptyText}>No members yet</Text>;
}

const styles = StyleSheet.create({
  headerRow: {
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  rowPressed: {
    backgroundColor: '#252545',
  },
  currentUserRow: {
    backgroundColor: '#1a1a2e',
    borderLeftWidth: 3,
    borderLeftColor: '#e94560',
  },
  eliminatedRow: {
    opacity: 0.6,
  },
  rankCol: {
    width: 40,
  },
  nameCol: {
    flex: 1,
  },
  scoreCol: {
    width: 60,
    textAlign: 'right',
  },
  statusCol: {
    width: 80,
    textAlign: 'right',
  },
  rank: {
    color: '#e94560',
    fontSize: 16,
    fontWeight: 'bold',
    width: 40,
  },
  nameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    color: '#ffffff',
    fontSize: 16,
    flexShrink: 1,
  },
  score: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    width: 60,
    textAlign: 'right',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
    width: 80,
    textAlign: 'right',
  },
  currentUserText: {
    color: '#e94560',
  },
  youBadge: {
    color: '#e94560',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: '#2a1a2e',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  dimmedText: {
    color: '#666666',
  },
  emptyText: {
    color: '#a0a0a0',
    textAlign: 'center',
    padding: 20,
  },
});

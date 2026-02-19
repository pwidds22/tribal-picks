import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../../stores/useAuthStore';
import {
  getCastaways,
  getActiveSeason,
  getNextEpisode,
  getSurvivorPoolPicks,
  saveSurvivorPoolPick,
  getSurvivorPoolStatus,
} from '../../services/supabase/queries';
import { getUsedCastaways } from '../../core/scoring';
import { isEpisodeLocked, getLockDeadlineLabel } from '../../core/locks';
import type { Castaway, Episode } from '../../core/types';

export default function SurvivorPoolScreen() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>();
  const user = useAuthStore((s) => s.user);

  const [castaways, setCastaways] = useState<Castaway[]>([]);
  const [nextEpisode, setNextEpisode] = useState<Episode | null>(null);
  const [usedIds, setUsedIds] = useState<number[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [isAlive, setIsAlive] = useState(true);
  const [poolStatus, setPoolStatus] = useState<
    { user_id: string; is_alive: boolean; username: string }[]
  >([]);
  const [isLocked, setIsLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const season = await getActiveSeason();
      if (!season) return;

      const [allCastaways, episode] = await Promise.all([
        getCastaways(season.id),
        getNextEpisode(season.id),
      ]);

      setCastaways(allCastaways.filter((c) => !c.is_eliminated));
      setNextEpisode(episode);
      if (episode) {
        setIsLocked(isEpisodeLocked(episode.air_date));
      }

      if (leagueId && user) {
        const [picks, status] = await Promise.all([
          getSurvivorPoolPicks(leagueId, user.id),
          getSurvivorPoolStatus(leagueId),
        ]);

        setPoolStatus(status);

        // Check if current user is still alive
        const userStatus = status.find((s) => s.user_id === user.id);
        if (userStatus) {
          setIsAlive(userStatus.is_alive);
        }

        // Separate current episode pick from previous picks
        if (episode) {
          const previousPicks = picks.filter((p) => p.episode_id !== episode.id);
          setUsedIds(getUsedCastaways(previousPicks));

          const existingPick = picks.find(
            (p) => p.episode_id === episode.id
          );
          if (existingPick) {
            setSelectedId(existingPick.picked_castaway_id);
            setSavedId(existingPick.picked_castaway_id);
          }
        } else {
          setUsedIds(getUsedCastaways(picks));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (castawayId: number) => {
    if (!isAlive || isLocked || usedIds.includes(castawayId)) return;
    setSelectedId(castawayId === selectedId ? null : castawayId);
  };

  const handleSave = async () => {
    if (!leagueId || !user || !nextEpisode || selectedId === null || isLocked) return;

    setIsSaving(true);
    try {
      await saveSurvivorPoolPick(leagueId, user.id, nextEpisode.id, selectedId);
      setSavedId(selectedId);
      Alert.alert(
        'Pick Saved!',
        `You picked ${castaways.find((c) => c.id === selectedId)?.name} to survive this episode.`
      );
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const hasPendingChange = selectedId !== null && selectedId !== savedId;
  const availableCount = castaways.filter((c) => !usedIds.includes(c.id)).length;
  const aliveCount = poolStatus.filter((s) => s.is_alive).length;
  const eliminatedCount = poolStatus.filter((s) => !s.is_alive).length;

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    );
  }

  if (!isAlive) {
    return (
      <View style={styles.center}>
        <Text style={styles.eliminatedEmoji}>🔥</Text>
        <Text style={styles.eliminatedTitle}>Your Torch Has Been Snuffed</Text>
        <Text style={styles.eliminatedText}>
          Your pick was eliminated. Better luck next season!
        </Text>
        <View style={styles.statusBar}>
          <Text style={styles.statusText}>
            {aliveCount} alive / {eliminatedCount} eliminated
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          Episode {nextEpisode?.number ?? '?'}
        </Text>
        <Text style={styles.headerSubtext}>
          {isLocked
            ? 'Picks are locked for this episode'
            : 'Pick one castaway who will SURVIVE this episode'}
        </Text>
        <View style={styles.statusBar}>
          <Text style={styles.statusAlive}>{aliveCount} alive</Text>
          <Text style={styles.statusDivider}>|</Text>
          <Text style={styles.statusOut}>{eliminatedCount} out</Text>
          <Text style={styles.statusDivider}>|</Text>
          <Text style={styles.statusUsed}>
            {usedIds.length} used
          </Text>
        </View>
      </View>

      {availableCount === 0 ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>
            No available castaways remaining!
          </Text>
        </View>
      ) : (
        <FlatList
          data={castaways}
          keyExtractor={(c) => c.id.toString()}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isSelected = item.id === selectedId;
            const isUsed = usedIds.includes(item.id);
            return (
              <Pressable
                style={[
                  styles.castawayCard,
                  isSelected && styles.castawayCardSelected,
                  isUsed && styles.castawayCardUsed,
                ]}
                onPress={() => handleSelect(item.id)}
                disabled={isUsed}
              >
                {item.photo_url ? (
                  <Image source={{ uri: item.photo_url }} style={styles.castawayPhoto} />
                ) : (
                  <Text style={styles.castawayEmoji}>🏝️</Text>
                )}
                <Text
                  style={[
                    styles.castawayName,
                    isSelected && styles.castawayNameSelected,
                  ]}
                >
                  {item.name}
                </Text>
                {item.hometown && (
                  <Text style={styles.hometown}>{item.hometown}</Text>
                )}
                {item.tribe && (
                  <Text style={styles.tribe}>{item.tribe}</Text>
                )}
                {isSelected && (
                  <View style={styles.checkBadge}>
                    <Text style={styles.checkText}>✓</Text>
                  </View>
                )}
                {isUsed && (
                  <View style={styles.usedBadge}>
                    <Text style={styles.usedBadgeText}>USED</Text>
                  </View>
                )}
              </Pressable>
            );
          }}
        />
      )}

      {selectedId !== null && !isLocked && (
        <Pressable
          style={[styles.saveButton, (!hasPendingChange || isSaving) && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={!hasPendingChange || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>
              {hasPendingChange ? 'Lock In Pick' : 'Pick Saved'}
            </Text>
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
    padding: 20,
  },
  header: {
    padding: 16,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  headerSubtext: {
    fontSize: 13,
    color: '#a0a0a0',
    marginBottom: 12,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusAlive: {
    color: '#2ed573',
    fontSize: 14,
    fontWeight: '600',
  },
  statusDivider: {
    color: '#444',
  },
  statusOut: {
    color: '#ff4757',
    fontSize: 14,
    fontWeight: '600',
  },
  statusUsed: {
    color: '#ffa502',
    fontSize: 14,
    fontWeight: '600',
  },
  statusText: {
    color: '#a0a0a0',
    fontSize: 14,
    marginTop: 12,
  },
  listContent: {
    padding: 12,
    paddingBottom: 100,
  },
  columnWrapper: {
    gap: 12,
  },
  castawayCard: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#2a2a4e',
  },
  castawayCardSelected: {
    borderColor: '#2ed573',
    backgroundColor: '#1a2e1a',
  },
  castawayCardUsed: {
    opacity: 0.4,
    borderColor: '#333',
  },
  castawayPhoto: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginBottom: 8,
    backgroundColor: '#16213e',
  },
  castawayEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  castawayName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  castawayNameSelected: {
    color: '#2ed573',
  },
  hometown: {
    color: '#888',
    fontSize: 10,
    marginTop: 2,
  },
  tribe: {
    color: '#a0a0a0',
    fontSize: 11,
    marginTop: 2,
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2ed573',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  usedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#666',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  usedBadgeText: {
    color: '#999',
    fontSize: 10,
    fontWeight: 'bold',
  },
  eliminatedEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  eliminatedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ff4757',
    marginBottom: 8,
    textAlign: 'center',
  },
  eliminatedText: {
    fontSize: 16,
    color: '#a0a0a0',
    textAlign: 'center',
  },
  errorText: {
    color: '#ff4757',
    fontSize: 16,
  },
  saveButton: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: '#2ed573',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

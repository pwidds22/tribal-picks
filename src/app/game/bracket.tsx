import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuthStore } from '../../stores/useAuthStore';
import {
  getCastaways,
  getActiveSeason,
  saveBracketPicks,
  getBracketPicks,
} from '../../services/supabase/queries';
import type { Castaway } from '../../core/types';

export default function BracketScreen() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>();
  const user = useAuthStore((s) => s.user);
  const [castaways, setCastaways] = useState<Castaway[]>([]);
  const [orderedIds, setOrderedIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const season = await getActiveSeason();
      if (!season) return;

      const allCastaways = await getCastaways(season.id);
      setCastaways(allCastaways);

      // Check for existing picks
      if (leagueId && user) {
        const existing = await getBracketPicks(leagueId, user.id);
        if (existing.length > 0) {
          // Restore saved order
          const savedOrder = existing
            .sort((a, b) => a.predicted_position - b.predicted_position)
            .map((p) => p.castaway_id);
          setOrderedIds(savedOrder);
          // TODO: Check if picks are locked (season started)
        } else {
          setOrderedIds(allCastaways.map((c) => c.id));
        }
      } else {
        setOrderedIds(allCastaways.map((c) => c.id));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const moveUp = (index: number) => {
    if (index === 0 || isLocked) return;
    const newOrder = [...orderedIds];
    [newOrder[index - 1], newOrder[index]] = [
      newOrder[index],
      newOrder[index - 1],
    ];
    setOrderedIds(newOrder);
  };

  const moveDown = (index: number) => {
    if (index === orderedIds.length - 1 || isLocked) return;
    const newOrder = [...orderedIds];
    [newOrder[index], newOrder[index + 1]] = [
      newOrder[index + 1],
      newOrder[index],
    ];
    setOrderedIds(newOrder);
  };

  const handleSave = async () => {
    if (!leagueId || !user || isLocked) return;

    setIsSaving(true);
    try {
      const picks = orderedIds.map((castawayId, index) => ({
        castaway_id: castawayId,
        predicted_position: index + 1, // 1 = first out, last = winner
      }));

      await saveBracketPicks(leagueId, user.id, picks);
      Alert.alert('Picks Saved!', 'Your elimination bracket has been saved. You can update it until the season premiere.');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const getCastaway = useCallback(
    (id: number) => castaways.find((c) => c.id === id),
    [castaways]
  );

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.instructions}>
        <Text style={styles.instructionText}>
          Order castaways from first eliminated (#1) to Sole Survivor (last).
          Use arrows to reorder.
        </Text>
      </View>

      <FlatList
        data={orderedIds}
        keyExtractor={(id) => id.toString()}
        renderItem={({ item: castawayId, index }) => {
          const castaway = getCastaway(castawayId);
          if (!castaway) return null;

          const isFirst = index === 0;
          const isLast = index === orderedIds.length - 1;

          return (
            <View style={styles.row}>
              <View style={styles.positionBadge}>
                <Text style={styles.positionText}>{index + 1}</Text>
              </View>

              <View style={styles.castawayInfo}>
                <Text style={styles.castawayName}>{castaway.name}</Text>
                {castaway.tribe && (
                  <Text style={styles.tribe}>{castaway.tribe}</Text>
                )}
              </View>

              <View style={styles.arrows}>
                <Pressable
                  onPress={() => moveUp(index)}
                  disabled={isFirst || isLocked}
                  style={[styles.arrow, isFirst && styles.arrowDisabled]}
                >
                  <Text style={styles.arrowText}>▲</Text>
                </Pressable>
                <Pressable
                  onPress={() => moveDown(index)}
                  disabled={isLast || isLocked}
                  style={[styles.arrow, isLast && styles.arrowDisabled]}
                >
                  <Text style={styles.arrowText}>▼</Text>
                </Pressable>
              </View>

              {isLast && (
                <View style={styles.winnerBadge}>
                  <Text style={styles.winnerText}>WINNER</Text>
                </View>
              )}
            </View>
          );
        }}
        contentContainerStyle={styles.listContent}
      />

      {!isLocked && (
        <Pressable
          style={[styles.saveButton, isSaving && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Bracket</Text>
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
  instructions: {
    padding: 16,
    backgroundColor: '#1a1a2e',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e',
  },
  instructionText: {
    color: '#a0a0a0',
    fontSize: 13,
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 100,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  positionBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#16213e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  positionText: {
    color: '#e94560',
    fontSize: 14,
    fontWeight: 'bold',
  },
  castawayInfo: {
    flex: 1,
  },
  castawayName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  tribe: {
    color: '#a0a0a0',
    fontSize: 12,
    marginTop: 2,
  },
  arrows: {
    flexDirection: 'row',
    gap: 8,
  },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#16213e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowDisabled: {
    opacity: 0.3,
  },
  arrowText: {
    color: '#e94560',
    fontSize: 14,
  },
  winnerBadge: {
    position: 'absolute',
    right: 16,
    backgroundColor: '#e94560',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  winnerText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  saveButton: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: '#e94560',
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

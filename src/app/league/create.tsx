import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../stores/useAuthStore';
import { createLeague, getActiveSeason } from '../../services/supabase/queries';
import type { GameType } from '../../core/types';

const GAME_TYPES: { value: GameType; label: string; description: string }[] = [
  {
    value: 'bracket',
    label: 'Elimination Bracket',
    description: 'Predict the full boot order before the season starts',
  },
  {
    value: 'survivor_pool',
    label: 'Survivor Pool',
    description:
      "Pick one castaway to survive each episode. Can't reuse. Last player standing wins.",
  },
];

export default function CreateLeagueScreen() {
  const [name, setName] = useState('');
  const [gameType, setGameType] = useState<GameType>('survivor_pool');
  const [isPublic, setIsPublic] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const user = useAuthStore((s) => s.user);

  const handleCreate = async () => {
    if (!user) {
      router.push('/auth');
      return;
    }
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a league name');
      return;
    }

    setIsLoading(true);
    try {
      const season = await getActiveSeason();
      if (!season) {
        Alert.alert('Error', 'No active season found');
        return;
      }

      const league = await createLeague(
        name.trim(),
        gameType,
        season.id,
        user.id,
        isPublic
      );

      Alert.alert(
        'League Created!',
        `Invite code: ${league.invite_code}\n\nShare this code with friends to join.`,
        [{ text: 'OK', onPress: () => router.replace(`/league/${league.id}`) }]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>League Name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., Tribal Council Legends"
        placeholderTextColor="#666"
        value={name}
        onChangeText={setName}
        maxLength={40}
      />

      <Text style={styles.label}>Game Type</Text>
      {GAME_TYPES.map((gt) => (
        <Pressable
          key={gt.value}
          style={[
            styles.gameTypeCard,
            gameType === gt.value && styles.gameTypeCardSelected,
          ]}
          onPress={() => setGameType(gt.value)}
        >
          <Text
            style={[
              styles.gameTypeLabel,
              gameType === gt.value && styles.gameTypeLabelSelected,
            ]}
          >
            {gt.label}
          </Text>
          <Text style={styles.gameTypeDesc}>{gt.description}</Text>
        </Pressable>
      ))}

      <Pressable
        style={styles.toggleRow}
        onPress={() => setIsPublic(!isPublic)}
      >
        <Text style={styles.toggleLabel}>Public League</Text>
        <View
          style={[styles.toggle, isPublic && styles.toggleActive]}
        >
          <View
            style={[styles.toggleDot, isPublic && styles.toggleDotActive]}
          />
        </View>
      </Pressable>

      <Pressable
        style={[styles.createButton, isLoading && styles.buttonDisabled]}
        onPress={handleCreate}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.createButtonText}>Create League</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
    padding: 20,
  },
  label: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 16,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  gameTypeCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#2a2a4e',
  },
  gameTypeCardSelected: {
    borderColor: '#e94560',
  },
  gameTypeLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  gameTypeLabelSelected: {
    color: '#e94560',
  },
  gameTypeDesc: {
    color: '#a0a0a0',
    fontSize: 13,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 12,
  },
  toggleLabel: {
    color: '#ffffff',
    fontSize: 16,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2a2a4e',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: '#e94560',
  },
  toggleDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  toggleDotActive: {
    alignSelf: 'flex-end',
  },
  createButton: {
    backgroundColor: '#e94560',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 30,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

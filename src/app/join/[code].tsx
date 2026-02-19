import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuthStore } from '../../stores/useAuthStore';
import { useLeagueStore } from '../../stores/useLeagueStore';
import { joinLeagueByCode } from '../../services/supabase/queries';

export default function JoinByCodeScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.isLoading);
  const invalidateLeagues = useLeagueStore((s) => s.invalidate);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace(`/league/join?prefill=${code}`);
      return;
    }

    joinAutomatically();
  }, [user, authLoading, code]);

  const joinAutomatically = async () => {
    if (!code || !user || isJoining) return;
    setIsJoining(true);
    try {
      const league = await joinLeagueByCode(code, user.id);
      invalidateLeagues();
      router.replace(`/league/${league.id}`);
    } catch (err: any) {
      Alert.alert('Could Not Join', err.message, [
        { text: 'OK', onPress: () => router.replace('/(tabs)/leagues') },
      ]);
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#e94560" />
      <Text style={styles.text}>Joining league...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  text: {
    color: '#ffffff',
    fontSize: 16,
  },
});

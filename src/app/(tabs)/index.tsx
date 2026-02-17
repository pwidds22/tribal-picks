import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '../../stores/useAuthStore';
import { useLeagueStore } from '../../stores/useLeagueStore';
import { useSeasonStore } from '../../stores/useSeasonStore';
import { getMillisUntilLock } from '../../core/locks';

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const leagueCount = useLeagueStore((s) => s.leagues.length);
  const fetchLeagues = useLeagueStore((s) => s.fetchLeagues);
  const { season, nextEpisode, fetchSeason } = useSeasonStore();
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    fetchSeason();
    if (user) fetchLeagues(user.id);
  }, [user]);

  // Countdown timer
  useEffect(() => {
    const update = () => {
      const remaining = getMillisUntilLock(season?.premiere_date ?? null);
      if (remaining <= 0) {
        setCountdown('');
        return;
      }
      const days = Math.floor(remaining / 86_400_000);
      const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
      setCountdown(`${days}d ${hours}h until premiere`);
    };

    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, [season?.premiere_date]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Tribal Picks</Text>
        <Text style={styles.subtitle}>Survivor Fantasy</Text>

        {/* Season Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Season {season?.number ?? 50}
          </Text>
          {season?.name && (
            <Text style={styles.cardSubtitle}>{season.name}</Text>
          )}
          {countdown ? (
            <Text style={styles.countdown}>{countdown}</Text>
          ) : (
            <Text style={styles.live}>SEASON IS LIVE</Text>
          )}
        </View>

        {/* Next Episode */}
        {nextEpisode && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              Next: Episode {nextEpisode.number}
            </Text>
            {nextEpisode.title && (
              <Text style={styles.cardDetail}>{nextEpisode.title}</Text>
            )}
            {nextEpisode.air_date && (
              <Text style={styles.cardDetail}>
                {new Date(nextEpisode.air_date + 'T00:00:00').toLocaleDateString(
                  'en-US',
                  { weekday: 'long', month: 'long', day: 'numeric' }
                )}
              </Text>
            )}
          </View>
        )}

        {/* Leagues / Auth Card */}
        {user ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              Your Leagues ({leagueCount})
            </Text>
            <Text style={styles.cardDetail}>
              {leagueCount > 0
                ? 'Manage your leagues and make picks'
                : 'Create or join a league to get started'}
            </Text>
            <View style={styles.buttonRow}>
              <Pressable
                style={[styles.button, styles.primaryButton]}
                onPress={() => router.push('/league/create')}
              >
                <Text style={styles.buttonText}>Create</Text>
              </Pressable>
              <Pressable
                style={[styles.button, styles.secondaryButton]}
                onPress={() => router.push('/league/join')}
              >
                <Text style={styles.buttonText}>Join</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Get Started</Text>
            <Text style={styles.cardDetail}>
              Sign in to create leagues, make picks, and compete with friends
            </Text>
            <Pressable
              style={[styles.button, styles.primaryButton, { marginTop: 12 }]}
              onPress={() => router.push('/auth')}
            >
              <Text style={styles.buttonText}>Sign In</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#e94560',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 30,
    opacity: 0.8,
  },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#e94560',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#e94560',
    marginBottom: 8,
  },
  cardDetail: {
    fontSize: 14,
    color: '#a0a0a0',
    marginBottom: 4,
  },
  countdown: {
    fontSize: 16,
    color: '#ffa502',
    fontWeight: '600',
    marginTop: 4,
  },
  live: {
    fontSize: 16,
    color: '#2ed573',
    fontWeight: 'bold',
    marginTop: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#e94560',
  },
  secondaryButton: {
    backgroundColor: '#16213e',
    borderWidth: 1,
    borderColor: '#e94560',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

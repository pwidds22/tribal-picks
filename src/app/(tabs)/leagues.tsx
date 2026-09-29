import { useEffect, useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '../../stores/useAuthStore';
import { useLeagueStore } from '../../stores/useLeagueStore';
import { useSeasonStore } from '../../stores/useSeasonStore';
import LeagueCard from '../../components/LeagueCard';
import AuthPrompt from '../../components/AuthPrompt';
import type { League } from '../../core/types';

export default function LeaguesScreen() {
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.isLoading);
  const authReady = useAuthStore((s) => s.authReady);
  const { leagues, isLoading, error, fetchLeagues, invalidate } = useLeagueStore();
  const { season, seasons, fetchSeason } = useSeasonStore();
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    fetchSeason();
    if (user && authReady) fetchLeagues(user.id);
  }, [user, authReady]);

  const handleRefresh = useCallback(() => {
    if (user) {
      invalidate();
      fetchLeagues(user.id);
    }
  }, [user]);

  if (!user && !authLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <AuthPrompt message="Sign in to create and join leagues." icon="people" />
      </SafeAreaView>
    );
  }

  if (isLoading && !leagues.length) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#e94560" />
        </View>
      </SafeAreaView>
    );
  }

  if (error && !leagues.length) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Failed to load leagues</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => {
              if (user) {
                invalidate();
                fetchLeagues(user.id);
              }
            }}
          >
            <Text style={styles.retryText}>Tap to Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const renderHeader = () => (
    <View>
      <Text style={styles.title}>My Leagues</Text>
      <View style={styles.buttonRow}>
        <Pressable
          style={[styles.button, styles.primaryButton]}
          onPress={() => router.push('/league/create')}
        >
          <Text style={styles.buttonText}>Create League</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.secondaryButton]}
          onPress={() => router.push('/league/join')}
        >
          <Text style={styles.buttonText}>Join League</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>No leagues yet</Text>
      <Text style={styles.emptySubtext}>
        Create a league or join one with an invite code
      </Text>
    </View>
  );

  const seasonNumberById = new Map(seasons.map((s) => [s.id, s.number]));
  const currentLeagues = leagues.filter((l) => !season || l.season_id === season.id);
  const pastLeagues = season ? leagues.filter((l) => l.season_id !== season.id) : [];
  // Past leagues are finished; keep them one tap away instead of crowding the list
  const sections = [
    ...(currentLeagues.length > 0
      ? [{ key: 'current', title: season ? `Season ${season.number}` : 'Current Season', data: currentLeagues }]
      : []),
    ...(pastLeagues.length > 0
      ? [{ key: 'past', title: `Past Seasons (${pastLeagues.length})`, data: showPast ? pastLeagues : [] }]
      : []),
  ];

  return (
    <SafeAreaView style={styles.container}>
      <SectionList<League, { key: string; title: string }>
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <LeagueCard
            league={item}
            seasonNumber={season && item.season_id !== season.id ? seasonNumberById.get(item.season_id) ?? null : null}
            onPress={() => router.push(`/league/${item.id}`)}
          />
        )}
        renderSectionHeader={({ section }) =>
          section.key === 'past' ? (
            <Pressable
              style={styles.pastToggle}
              onPress={() => setShowPast((v) => !v)}
              hitSlop={8}
            >
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Ionicons name={showPast ? 'chevron-up' : 'chevron-down'} size={16} color="#a0a0a0" />
            </Pressable>
          ) : sections.length > 1 ? (
            <Text style={styles.sectionTitle}>{section.title}</Text>
          ) : null
        }
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={handleRefresh}
            tintColor="#e94560"
          />
        }
      />
    </SafeAreaView>
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
  content: {
    padding: 20,
    flexGrow: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#a0a0a0',
    marginTop: 8,
    marginBottom: 12,
  },
  pastToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
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
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#ffffff',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#a0a0a0',
    textAlign: 'center',
  },
  errorText: {
    color: '#ff4757',
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#e94560',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

import { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/useAuthStore';
import { useLeagueStore } from '../../stores/useLeagueStore';
import { useSeasonStore } from '../../stores/useSeasonStore';
import { getMillisUntilLock } from '../../core/locks';
import { getBracketPicks, getSurvivorPoolPicks } from '../../services/supabase/queries';
import { GAME_TYPE_META } from '../../core/gameTypes';
import AnnouncementBanner from '../../components/AnnouncementBanner';
import type { League } from '../../core/types';

// ---------- Sub-Components ----------

/** Big countdown with days/hours/minutes and progress bar */
function CountdownHero({
  premiereDate,
}: {
  premiereDate: string | null;
}) {
  const [remaining, setRemaining] = useState(() =>
    getMillisUntilLock(premiereDate),
  );

  useEffect(() => {
    const update = () => setRemaining(getMillisUntilLock(premiereDate));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [premiereDate]);

  if (remaining <= 0) {
    return (
      <View style={countdownStyles.liveContainer}>
        <View style={countdownStyles.livePulse}>
          <View style={countdownStyles.liveDot} />
        </View>
        <View>
          <Text style={countdownStyles.liveText}>Season is Live</Text>
          <Text style={countdownStyles.liveSubtext}>
            Set your picks before each episode
          </Text>
        </View>
      </View>
    );
  }

  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);

  // Progress: how much of a 90-day pre-season window has passed
  const totalWait = 90 * 86_400_000;
  const elapsed = totalWait - remaining;
  const pct = Math.min(Math.max(elapsed / totalWait, 0), 1) * 100;

  return (
    <View style={countdownStyles.container}>
      <Text style={countdownStyles.title}>PREMIERE COUNTDOWN</Text>
      <View style={countdownStyles.digits}>
        <View style={countdownStyles.unit}>
          <Text style={countdownStyles.value}>{days}</Text>
          <Text style={countdownStyles.label}>DAYS</Text>
        </View>
        <Text style={countdownStyles.separator}>:</Text>
        <View style={countdownStyles.unit}>
          <Text style={countdownStyles.value}>
            {String(hours).padStart(2, '0')}
          </Text>
          <Text style={countdownStyles.label}>HRS</Text>
        </View>
        <Text style={countdownStyles.separator}>:</Text>
        <View style={countdownStyles.unit}>
          <Text style={countdownStyles.value}>
            {String(minutes).padStart(2, '0')}
          </Text>
          <Text style={countdownStyles.label}>MIN</Text>
        </View>
        <Text style={countdownStyles.separator}>:</Text>
        <View style={countdownStyles.unit}>
          <Text style={countdownStyles.value}>
            {String(seconds).padStart(2, '0')}
          </Text>
          <Text style={countdownStyles.label}>SEC</Text>
        </View>
      </View>
      <View style={countdownStyles.progressTrack}>
        <View
          style={[countdownStyles.progressFill, { width: `${pct}%` }]}
        />
      </View>
      <Text style={countdownStyles.lockNote}>
        Bracket picks lock at premiere
      </Text>
    </View>
  );
}

/** Contextual action banner that changes based on user state */
function ActionBanner({
  leagues,
  hasActiveCountdown,
  nextEpisodeId,
}: {
  leagues: League[];
  hasActiveCountdown: boolean;
  nextEpisodeId: number | null;
}) {
  const bracketLeagues = useMemo(
    () => leagues.filter((l) => l.game_type === 'bracket'),
    [leagues],
  );
  const poolLeagues = useMemo(
    () => leagues.filter((l) => l.game_type === 'survivor_pool'),
    [leagues],
  );

  // Track which leagues still need picks — re-check on every focus
  const [leaguesNeedingPicks, setLeaguesNeedingPicks] = useState<League[]>([]);

  // Subscribe reactively (not getState()) so the check re-runs the moment
  // authReady flips true on cold start, instead of waiting for a refocus.
  const user = useAuthStore((s) => s.user);
  const authReady = useAuthStore((s) => s.authReady);

  useFocusEffect(
    useCallback(() => {
      const allLeagues = [...bracketLeagues, ...poolLeagues];
      if (!user || !authReady || allLeagues.length === 0) {
        setLeaguesNeedingPicks([]);
        return;
      }
      let cancelled = false;
      Promise.all(
        allLeagues.map(async (league) => {
          if (league.game_type === 'bracket') {
            const picks = await getBracketPicks(league.id, user.id);
            return { league, hasPicks: picks.length > 0 };
          }
          // Survivor pool — check if pick exists for next episode
          if (nextEpisodeId) {
            const picks = await getSurvivorPoolPicks(league.id, user.id);
            const hasCurrentPick = picks.some((p) => p.episode_id === nextEpisodeId);
            return { league, hasPicks: hasCurrentPick };
          }
          return { league, hasPicks: true };
        }),
      ).then((results) => {
        if (!cancelled) {
          setLeaguesNeedingPicks(
            results.filter((r) => !r.hasPicks).map((r) => r.league),
          );
        }
      });
      return () => { cancelled = true; };
    }, [user, authReady, bracketLeagues, poolLeagues, nextEpisodeId]),
  );

  if (leagues.length === 0) {
    return (
      <View style={bannerStyles.container}>
        <Ionicons name="flame-outline" size={22} color="#e94560" />
        <View style={bannerStyles.content}>
          <Text style={bannerStyles.headline}>
            Start Your Survivor Journey
          </Text>
          <Text style={bannerStyles.subtitle}>
            Create a league and invite friends to play
          </Text>
        </View>
      </View>
    );
  }

  const totalNeeding = leaguesNeedingPicks.length;

  if (hasActiveCountdown) {
    return (
      <Pressable
        style={bannerStyles.container}
        onPress={() => {
          if (totalNeeding > 0) {
            router.push(`/league/${leaguesNeedingPicks[0].id}`);
          }
        }}
      >
        <Ionicons name="alert-circle" size={22} color="#ffa502" />
        <View style={bannerStyles.content}>
          <Text style={bannerStyles.headline}>
            {totalNeeding > 0
              ? `${totalNeeding} league${totalNeeding > 1 ? 's' : ''} need${totalNeeding === 1 ? 's' : ''} picks`
              : 'You\'re all set for premiere!'}
          </Text>
          <Text style={bannerStyles.subtitle}>
            {totalNeeding > 0
              ? 'Set your predictions before picks lock'
              : 'All picks are locked in'}
          </Text>
        </View>
        {totalNeeding > 0 && (
          <Ionicons name="chevron-forward" size={18} color="#666" />
        )}
      </Pressable>
    );
  }

  // Season is live
  return (
    <Pressable
      style={bannerStyles.container}
      onPress={() => {
        if (totalNeeding > 0) {
          router.push(`/league/${leaguesNeedingPicks[0].id}`);
        }
      }}
    >
      <Ionicons name="timer-outline" size={22} color="#e94560" />
      <View style={bannerStyles.content}>
        <Text style={bannerStyles.headline}>
          {totalNeeding > 0
            ? `${totalNeeding} league${totalNeeding > 1 ? 's' : ''} need${totalNeeding === 1 ? 's' : ''} picks this week`
            : 'Season in progress'}
        </Text>
        <Text style={bannerStyles.subtitle}>
          {totalNeeding > 0
            ? 'Pick before the episode airs'
            : 'Check your standings'}
        </Text>
      </View>
      {totalNeeding > 0 && (
        <Ionicons name="chevron-forward" size={18} color="#666" />
      )}
    </Pressable>
  );
}

/** Enhanced league card with game type accent stripe and status */
function LeagueCardEnhanced({
  league,
}: {
  league: League;
}) {
  const meta = GAME_TYPE_META[league.game_type] ?? {
    label: league.game_type,
    icon: 'help-circle-outline' as const,
    accentColor: '#666',
  };

  return (
    <Pressable
      style={leagueStyles.card}
      onPress={() => router.push(`/league/${league.id}`)}
    >
      {/* Left accent stripe */}
      <View
        style={[leagueStyles.accentStripe, { backgroundColor: meta.accentColor }]}
      />
      <View style={leagueStyles.cardContent}>
        <View
          style={[
            leagueStyles.iconContainer,
            { backgroundColor: meta.accentColor + '20' },
          ]}
        >
          <Ionicons
            name={meta.icon as keyof typeof Ionicons.glyphMap}
            size={20}
            color={meta.accentColor}
          />
        </View>
        <View style={leagueStyles.info}>
          <Text style={leagueStyles.name}>{league.name}</Text>
          <View style={leagueStyles.metaRow}>
            <Text style={leagueStyles.type}>{meta.label}</Text>
            {league.is_public && (
              <View style={leagueStyles.publicBadge}>
                <Text style={leagueStyles.publicBadgeText}>Public</Text>
              </View>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#444" />
      </View>
    </Pressable>
  );
}

/** Game mode preview cards for users with no leagues */
function GameModePreview() {
  return (
    <View style={previewStyles.container}>
      <Text style={previewStyles.sectionTitle}>GAME MODES</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={previewStyles.scroll}
      >
        {/* Bracket preview */}
        <View style={[previewStyles.card, { borderColor: '#e9456040' }]}>
          <View
            style={[
              previewStyles.iconCircle,
              { backgroundColor: '#e9456020' },
            ]}
          >
            <Ionicons name="git-branch-outline" size={24} color="#e94560" />
          </View>
          <Text style={previewStyles.cardTitle}>Elimination Bracket</Text>
          <Text style={previewStyles.cardDesc}>
            Predict the full boot order before the premiere. Set it and forget
            it.
          </Text>
          <View style={previewStyles.pills}>
            <View style={[previewStyles.pill, { backgroundColor: '#0d2e0d' }]}>
              <Text style={[previewStyles.pillText, { color: '#4ecdc4' }]}>
                Beginner Friendly
              </Text>
            </View>
            <View style={[previewStyles.pill, { backgroundColor: '#0d1a2e' }]}>
              <Text style={[previewStyles.pillText, { color: '#74b9ff' }]}>
                Set Once
              </Text>
            </View>
          </View>
        </View>

        {/* Pool preview */}
        <View style={[previewStyles.card, { borderColor: '#ffa50240' }]}>
          <View
            style={[
              previewStyles.iconCircle,
              { backgroundColor: '#ffa50220' },
            ]}
          >
            <Ionicons name="skull-outline" size={24} color="#ffa502" />
          </View>
          <Text style={previewStyles.cardTitle}>Survivor Pool</Text>
          <Text style={previewStyles.cardDesc}>
            Pick one castaway to survive each episode. Get it wrong and you're
            out.
          </Text>
          <View style={previewStyles.pills}>
            <View style={[previewStyles.pill, { backgroundColor: '#2e1a0d' }]}>
              <Text style={[previewStyles.pillText, { color: '#ffa502' }]}>
                Strategic
              </Text>
            </View>
            <View style={[previewStyles.pill, { backgroundColor: '#2e0d0d' }]}>
              <Text style={[previewStyles.pillText, { color: '#e94560' }]}>
                Elimination
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ---------- Main Screen ----------

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.isLoading);
  const authReady = useAuthStore((s) => s.authReady);
  const profile = useAuthStore((s) => s.profile);
  const leagues = useLeagueStore((s) => s.leagues);
  const fetchLeagues = useLeagueStore((s) => s.fetchLeagues);
  const { season, nextEpisode, fetchSeason } = useSeasonStore();

  const [countdownActive, setCountdownActive] = useState(false);

  useEffect(() => {
    fetchSeason(); // public data, no auth needed
    if (user && authReady) fetchLeagues(user.id);
  }, [user, authReady]);

  // Re-fetch leagues whenever the home tab regains focus (e.g. after creating a league)
  useFocusEffect(
    useCallback(() => {
      if (user && authReady) fetchLeagues(user.id);
    }, [user, authReady]),
  );

  useEffect(() => {
    const remaining = getMillisUntilLock(season?.premiere_date ?? null);
    setCountdownActive(remaining > 0);
  }, [season?.premiere_date]);

  const displayName =
    profile?.display_name || profile?.username || 'Player';

  // Group leagues by game type for section display
  const leaguesByType = useMemo(() => {
    const groups: Record<string, League[]> = {};
    for (const league of leagues) {
      if (!groups[league.game_type]) groups[league.game_type] = [];
      groups[league.game_type].push(league);
    }
    return groups;
  }, [leagues]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.greeting}>Hey, {displayName}</Text>
          <Text style={styles.appName}>Tribal Picks</Text>
          {season && (
            <Text style={styles.seasonLabel}>
              Season {season.number}
              {season.name ? ` \u2022 ${season.name}` : ''}
            </Text>
          )}
        </View>

        {/* Announcements */}
        <AnnouncementBanner />

        {/* Countdown / Live Badge */}
        <CountdownHero premiereDate={season?.premiere_date ?? null} />

        {/* Next Episode */}
        {nextEpisode && (
          <View style={styles.episodeCard}>
            <View style={styles.episodeIconBox}>
              <Ionicons name="tv-outline" size={16} color="#e94560" />
            </View>
            <View style={styles.episodeInfo}>
              <Text style={styles.episodeTitle}>
                Episode {nextEpisode.number}
                {nextEpisode.title ? ` \u2014 ${nextEpisode.title}` : ''}
              </Text>
              {nextEpisode.air_date && (
                <Text style={styles.episodeDate}>
                  {new Date(
                    nextEpisode.air_date + 'T00:00:00',
                  ).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Contextual Action Banner */}
        <ActionBanner
          leagues={leagues}
          hasActiveCountdown={countdownActive}
          nextEpisodeId={nextEpisode?.id ?? null}
        />

        {/* Quick Actions */}
        <View style={styles.actions}>
          <Pressable
            style={styles.actionButton}
            onPress={() => router.push('/league/create')}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="add" size={24} color="#e94560" />
            </View>
            <Text style={styles.actionLabel}>Create League</Text>
          </Pressable>
          <Pressable
            style={styles.actionButton}
            onPress={() => router.push('/league/join')}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="enter-outline" size={24} color="#e94560" />
            </View>
            <Text style={styles.actionLabel}>Join League</Text>
          </Pressable>
        </View>

        {/* Leagues */}
        {leagues.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>YOUR LEAGUES</Text>
            <View style={styles.leagueList}>
              {leagues.map((league) => (
                <LeagueCardEnhanced key={league.id} league={league} />
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.emptySection}>
            {/* Game mode preview cards for new users */}
            <GameModePreview />

            <View style={styles.emptyCard}>
              <Ionicons name="people-outline" size={32} color="#2a2a4e" />
              <Text style={styles.emptyTitle}>No leagues yet</Text>
              <Text style={styles.emptySubtitle}>
                Create a league and invite your friends to get started
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------- Styles ----------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  content: {
    padding: 20,
    paddingBottom: 32,
  },

  // Hero
  hero: {
    marginBottom: 20,
  },
  greeting: {
    fontSize: 15,
    color: '#a0a0a0',
    marginBottom: 2,
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  seasonLabel: {
    fontSize: 14,
    color: '#e94560',
    marginTop: 4,
    fontWeight: '500',
  },

  // Episode
  episodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  episodeIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#16213e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  episodeInfo: {
    flex: 1,
  },
  episodeTitle: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },
  episodeDate: {
    fontSize: 12,
    color: '#a0a0a0',
    marginTop: 2,
  },

  // Quick Actions
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#16213e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },

  // Section
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e94560',
    letterSpacing: 1,
    marginBottom: 4,
  },
  leagueList: {
    gap: 8,
  },

  // Empty state
  emptySection: {
    gap: 20,
  },
  emptyCard: {
    alignItems: 'center',
    padding: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#444',
    textAlign: 'center',
    lineHeight: 18,
  },
});

const countdownStyles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2014',
    alignItems: 'center',
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffa502',
    letterSpacing: 2,
    marginBottom: 12,
  },
  digits: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: 16,
  },
  unit: {
    alignItems: 'center',
    minWidth: 50,
  },
  value: {
    fontSize: 36,
    fontWeight: '800',
    color: '#ffffff',
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    color: '#555',
    letterSpacing: 2,
    marginTop: 2,
  },
  separator: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffa502',
    marginBottom: 14,
    marginHorizontal: 2,
  },
  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: '#16213e',
    borderRadius: 2,
    marginBottom: 10,
  },
  progressFill: {
    height: 4,
    backgroundColor: '#ffa502',
    borderRadius: 2,
  },
  lockNote: {
    fontSize: 11,
    color: '#555',
  },

  // Live state
  liveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0d1f0d',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1a3a1a',
  },
  livePulse: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2ed57333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2ed573',
  },
  liveText: {
    fontSize: 15,
    color: '#2ed573',
    fontWeight: '700',
  },
  liveSubtext: {
    fontSize: 12,
    color: '#1a6a1a',
    marginTop: 1,
  },
});

const bannerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  content: {
    flex: 1,
  },
  headline: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 1,
  },
});

const leagueStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  accentStripe: {
    width: 4,
  },
  cardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  type: {
    fontSize: 12,
    color: '#a0a0a0',
  },
  publicBadge: {
    backgroundColor: '#16213e',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  publicBadgeText: {
    fontSize: 10,
    color: '#4ecdc4',
    fontWeight: '600',
  },
});

const previewStyles = StyleSheet.create({
  container: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e94560',
    letterSpacing: 1,
  },
  scroll: {
    gap: 12,
    paddingRight: 4,
  },
  card: {
    width: 240,
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    gap: 10,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  cardDesc: {
    fontSize: 13,
    color: '#888',
    lineHeight: 18,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
  },
});

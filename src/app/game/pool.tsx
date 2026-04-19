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
  Modal,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/useAuthStore';
import {
  getCastaways,
  getCastawaysAliveAtEpisode,
  getActiveSeason,
  getLeague,
  getNextEpisode,
  getNextEpisodeFromStart,
  getSurvivorPoolPicks,
  saveSurvivorPoolPick,
  getSurvivorPoolStatus,
  getAllPoolPicksForEpisode,
  getLeagueMembers,
  getPickSubmissionStatus,
  getEpisodes,
  getLastScoredEpisode,
} from '../../services/supabase/queries';
import { getUsedCastaways } from '../../core/scoring';
import { isEpisodeLocked, getLockDeadlineLabel } from '../../core/locks';
import type { Castaway, Episode, Season } from '../../core/types';

export default function SurvivorPoolScreen() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>();
  const user = useAuthStore((s) => s.user);
  const authReady = useAuthStore((s) => s.authReady);

  const [castaways, setCastaways] = useState<Castaway[]>([]);
  const [allCastawaysList, setAllCastawaysList] = useState<Castaway[]>([]);
  const [nextEpisode, setNextEpisode] = useState<Episode | null>(null);
  const [usedIds, setUsedIds] = useState<number[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [winnerPickId, setWinnerPickId] = useState<number | null>(null);
  const [savedWinnerPickId, setSavedWinnerPickId] = useState<number | null>(null);
  const [isFinale, setIsFinale] = useState(false);
  const [isAlive, setIsAlive] = useState(true);
  const [poolStatus, setPoolStatus] = useState<
    { user_id: string; is_alive: boolean; username: string }[]
  >([]);
  const [isLocked, setIsLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [leaguePicks, setLeaguePicks] = useState<
    { userName: string; castawayName: string; isAlive: boolean }[]
  >([]);
  const [previousEpisodePicks, setPreviousEpisodePicks] = useState<
    { userName: string; castawayName: string; isAlive: boolean }[]
  >([]);
  const [previousEpisodeNumber, setPreviousEpisodeNumber] = useState<number | null>(null);
  const [submittedUserIds, setSubmittedUserIds] = useState<string[]>([]);
  const [leagueMembers, setLeagueMembers] = useState<
    { user_id: string; name: string }[]
  >([]);

  // Wait for auth token to be refreshed before hitting Supabase
  useEffect(() => {
    if (!authReady) return;
    loadData();
  }, [authReady]);

  const loadData = async () => {
    try {
      const season = await getActiveSeason();
      if (!season) return;

      // Fetch league to get start_episode
      let startEp = 1;
      if (leagueId) {
        const league = await getLeague(leagueId);
        if (league) startEp = league.start_episode;
      }

      // Load castaways alive at start episode, then filter to currently alive
      const castawaysFetch = startEp > 1
        ? getCastawaysAliveAtEpisode(season.id, startEp)
        : getCastaways(season.id);
      const episodeFetch = startEp > 1
        ? getNextEpisodeFromStart(season.id, startEp)
        : getNextEpisode(season.id);

      const [allCastaways, episode, episodes] = await Promise.all([
        castawaysFetch,
        episodeFetch,
        getEpisodes(season.id),
      ]);

      setCastaways(allCastaways.filter((c) => !c.is_eliminated));
      setAllCastawaysList(allCastaways);
      setNextEpisode(episode);
      if (episode) {
        setIsLocked(isEpisodeLocked(episode.air_date));

        // Detect finale: last episode of the season or matches finale_date
        const maxEpNum = Math.max(...episodes.map((e) => e.number));
        const finale =
          episode.number === maxEpNum ||
          (season.finale_date != null && episode.air_date === season.finale_date);
        setIsFinale(finale);
      }

      // Fetch league pick data for the current episode
      if (leagueId && episode) {
        const locked = isEpisodeLocked(episode.air_date);
        const members = await getLeagueMembers(leagueId);
        const memberMap = new Map(
          members.map((m) => [m.user_id, m.display_name ?? m.username])
        );
        const membersList = members.map((m) => ({
          user_id: m.user_id,
          name: m.display_name ?? m.username,
        }));
        setLeagueMembers(membersList);

        if (locked) {
          // After lock: show everyone's actual picks for this episode
          const allPicks = await getAllPoolPicksForEpisode(leagueId, episode.id);
          setLeaguePicks(
            allPicks.map((p) => ({
              userName: memberMap.get(p.user_id) ?? 'Unknown',
              castawayName: p.castaway_name,
              isAlive: p.is_alive,
            }))
          );
        } else {
          // Before lock: show who submitted (no castaway revealed)
          const submitted = await getPickSubmissionStatus(leagueId, episode.id);
          setSubmittedUserIds(submitted);

          // Also fetch the PREVIOUS scored episode's picks so users can see
          // what everyone picked last week
          const lastScored = await getLastScoredEpisode(season.id);
          if (lastScored) {
            setPreviousEpisodeNumber(lastScored.number);
            const prevPicks = await getAllPoolPicksForEpisode(leagueId, lastScored.id);
            setPreviousEpisodePicks(
              prevPicks.map((p) => ({
                userName: memberMap.get(p.user_id) ?? 'Unknown',
                castawayName: p.castaway_name,
                isAlive: p.is_alive,
              }))
            );
          }
        }
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
            if (existingPick.winner_pick_id) {
              setWinnerPickId(existingPick.winner_pick_id);
              setSavedWinnerPickId(existingPick.winner_pick_id);
            }
          }
        } else {
          setUsedIds(getUsedCastaways(picks));
        }
      }
    } catch {
      Alert.alert('Error', 'Failed to load pool data. Please try again.');
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
    if (isFinale && winnerPickId === null) {
      Alert.alert('Pick a Winner', 'For the finale, you must also pick who you think will be the Sole Survivor.');
      return;
    }

    setIsSaving(true);
    try {
      await saveSurvivorPoolPick(
        leagueId, user.id, nextEpisode.id, selectedId,
        isFinale && winnerPickId !== null ? winnerPickId : undefined,
      );
      setSavedId(selectedId);
      if (isFinale) setSavedWinnerPickId(winnerPickId);
      const pickedName = castaways.find((c) => c.id === selectedId)?.name;
      Alert.alert(
        'Pick Saved!',
        isFinale
          ? `Survivor pick and winner tiebreaker saved. Good luck in the finale!`
          : `You picked ${pickedName} to survive this episode.`,
      );
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save pick.');
    } finally {
      setIsSaving(false);
    }
  };

  const hasPendingChange =
    (selectedId !== null && selectedId !== savedId) ||
    (isFinale && winnerPickId !== savedWinnerPickId);
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
        {isFinale && (
          <Text style={styles.finaleLabel}>FINALE</Text>
        )}
        <Text style={styles.headerTitle}>
          Episode {nextEpisode?.number ?? '?'}
        </Text>
        <View style={styles.headerSubtextRow}>
          <Text style={styles.headerSubtext}>
            {isLocked
              ? 'Picks are locked for this episode'
              : isFinale
                ? 'Pick a survivor + predict the winner'
                : 'Pick one castaway to survive this episode'}
          </Text>
          <Pressable onPress={() => setShowRules(true)} hitSlop={12}>
            <Ionicons name="information-circle-outline" size={20} color="#a0a0a0" />
          </Pressable>
        </View>
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
          ListHeaderComponent={
            leagueMembers.length > 0 ? (
              <MemberPicksSummary
                members={leagueMembers}
                submittedUserIds={submittedUserIds}
                leaguePicks={leaguePicks}
                previousEpisodePicks={previousEpisodePicks}
                previousEpisodeNumber={previousEpisodeNumber}
                isLocked={isLocked}
                currentUserId={user?.id ?? ''}
                currentEpisodeNumber={nextEpisode?.number ?? null}
              />
            ) : null
          }
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

      {/* Winner tiebreaker section (finale only) */}
      {isFinale && !isLocked && (
        <View style={styles.winnerSection}>
          <Text style={styles.winnerSectionTitle}>TIEBREAKER: PICK THE WINNER</Text>
          <Text style={styles.winnerSectionSubtext}>
            Who will be the Sole Survivor? Used to break ties.
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.winnerScroll}
          >
            {allCastawaysList.filter((c) => !c.is_eliminated).map((c) => {
              const isWinnerPick = c.id === winnerPickId;
              return (
                <Pressable
                  key={c.id}
                  style={[
                    styles.winnerCard,
                    isWinnerPick && styles.winnerCardSelected,
                  ]}
                  onPress={() => setWinnerPickId(c.id === winnerPickId ? null : c.id)}
                >
                  {c.photo_url ? (
                    <Image source={{ uri: c.photo_url }} style={styles.winnerPhoto} />
                  ) : (
                    <Text style={styles.winnerEmoji}>🏝️</Text>
                  )}
                  <Text
                    style={[
                      styles.winnerName,
                      isWinnerPick && styles.winnerNameSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {c.name}
                  </Text>
                  {isWinnerPick && (
                    <Ionicons name="trophy" size={14} color="#ffa502" style={{ marginTop: 2 }} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
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

      <Modal
        visible={showRules}
        animationType="slide"
        transparent
        onRequestClose={() => setShowRules(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Survivor Pool Rules</Text>
            <ScrollView style={styles.modalScroll}>
              <Text style={styles.ruleText}>
                {'\u2022'} Pick one castaway per episode to SURVIVE. If your picked castaway is eliminated, YOU are eliminated from the pool.{'\n\n'}
                {'\u2022'} You cannot reuse a castaway you{"'"}ve already picked in a previous episode.{'\n\n'}
                {'\u2022'} The last fantasy player remaining in the pool wins. This is about YOU outlasting other players, not your castaways.{'\n\n'}
                {'\u2022'} If an episode has multiple tribal councils, a castaway eliminated in ANY tribal counts as eliminated. Choose carefully on double-elimination episodes.{'\n\n'}
                {'\u2022'} Picks lock when the episode airs. You can change your pick up until lock time.{'\n\n'}
                {'\u2022'} Medevac or quit counts as an elimination.{'\n\n'}
                {'\u2022'} Recap/reunion episodes with no tribal council require no pick.{'\n\n'}
                {'\u2022'} In the finale, anyone who makes the Final 3 is NOT eliminated — they survive.{'\n\n'}
                {'\u2022'} Tiebreaker: For the finale, you also pick who you think will be the Sole Survivor. If multiple players are tied, the one who correctly predicted the winner wins.
              </Text>
            </ScrollView>
            <Pressable
              style={styles.modalCloseButton}
              onPress={() => setShowRules(false)}
            >
              <Text style={styles.modalCloseText}>Got It</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MemberPicksSummary({
  members,
  submittedUserIds,
  leaguePicks,
  previousEpisodePicks,
  previousEpisodeNumber,
  isLocked,
  currentUserId,
  currentEpisodeNumber,
}: {
  members: { user_id: string; name: string }[];
  submittedUserIds: string[];
  leaguePicks: { userName: string; castawayName: string; isAlive: boolean }[];
  previousEpisodePicks: { userName: string; castawayName: string; isAlive: boolean }[];
  previousEpisodeNumber: number | null;
  isLocked: boolean;
  currentUserId: string;
  currentEpisodeNumber: number | null;
}) {
  if (members.length === 0) return null;

  const submittedCount = isLocked ? leaguePicks.length : submittedUserIds.length;

  // Which picks to show as revealed: current ep (if locked) or previous ep (if not locked)
  const revealedPicks = isLocked ? leaguePicks : previousEpisodePicks;
  const revealedEpLabel = isLocked
    ? `Episode ${currentEpisodeNumber ?? '?'} Picks`
    : previousEpisodeNumber != null
      ? `Episode ${previousEpisodeNumber} Picks`
      : null;

  return (
    <View>
      {/* Revealed picks section — either current (locked) or previous episode */}
      {revealedPicks.length > 0 && revealedEpLabel && (
        <View style={styles.leaguePicksSection}>
          <Text style={styles.leaguePicksTitle}>{revealedEpLabel}</Text>
          <Text style={styles.leaguePicksSubtext}>
            Everyone{'\u2019'}s pick {isLocked ? 'for this episode' : 'from last episode'}
          </Text>
          {members.map((m) => {
            const isCurrentUser = m.user_id === currentUserId;
            const pick = revealedPicks.find((p) => p.userName === m.name);
            return (
              <View
                key={m.user_id}
                style={[styles.leaguePickRow, isCurrentUser && styles.currentUserRow]}
              >
                <Ionicons
                  name="person-circle-outline"
                  size={24}
                  color={isCurrentUser ? '#e94560' : '#666'}
                  style={{ marginRight: 10 }}
                />
                <Text
                  style={[styles.leaguePickName, isCurrentUser && styles.currentUserName]}
                  numberOfLines={1}
                >
                  {m.name}{isCurrentUser ? ' (You)' : ''}
                </Text>
                <View style={styles.leaguePickRight}>
                  <Text
                    style={[
                      styles.leaguePickCastaway,
                      !pick && styles.noPick,
                    ]}
                    numberOfLines={1}
                  >
                    {pick ? pick.castawayName : 'No pick'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Current episode submission status (only when not locked) */}
      {!isLocked && (
        <View style={[styles.leaguePicksSection, { marginTop: 12 }]}>
          <Text style={styles.leaguePicksTitle}>
            Episode {currentEpisodeNumber ?? '?'} — Pick Status
          </Text>
          <Text style={styles.leaguePicksSubtext}>
            {submittedCount} of {members.length} picks submitted
          </Text>
          {members.map((m) => {
            const isCurrentUser = m.user_id === currentUserId;
            const submitted = submittedUserIds.includes(m.user_id);
            return (
              <View
                key={m.user_id}
                style={[styles.leaguePickRow, isCurrentUser && styles.currentUserRow]}
              >
                <Ionicons
                  name={submitted ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={submitted ? '#2ed573' : '#444'}
                  style={{ marginRight: 10 }}
                />
                <Text
                  style={[styles.leaguePickName, isCurrentUser && styles.currentUserName]}
                  numberOfLines={1}
                >
                  {m.name}{isCurrentUser ? ' (You)' : ''}
                </Text>
                <View style={styles.leaguePickRight}>
                  <Text
                    style={[
                      styles.pickStatusText,
                      { color: submitted ? '#2ed573' : '#666' },
                    ]}
                  >
                    {submitted ? 'Submitted' : 'Pending'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
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
  headerSubtextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 12,
  },
  headerSubtext: {
    fontSize: 13,
    color: '#a0a0a0',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#e94560',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalScroll: {
    marginBottom: 16,
  },
  ruleText: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 22,
  },
  modalCloseButton: {
    backgroundColor: '#e94560',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  finaleLabel: {
    color: '#ffa502',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 4,
  },
  winnerSection: {
    backgroundColor: '#1a1a2e',
    borderTopWidth: 1,
    borderTopColor: '#2a2a4e',
    paddingVertical: 16,
    paddingBottom: 100,
  },
  winnerSectionTitle: {
    color: '#ffa502',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 4,
  },
  winnerSectionSubtext: {
    color: '#a0a0a0',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
  },
  winnerScroll: {
    paddingHorizontal: 12,
    gap: 10,
  },
  winnerCard: {
    backgroundColor: '#16213e',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    width: 80,
    borderWidth: 2,
    borderColor: '#2a2a4e',
  },
  winnerCardSelected: {
    borderColor: '#ffa502',
    backgroundColor: '#2e2a1a',
  },
  winnerPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 4,
    backgroundColor: '#16213e',
  },
  winnerEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  winnerName: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  winnerNameSelected: {
    color: '#ffa502',
  },
  leaguePicksSection: {
    marginTop: 16,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  leaguePicksTitle: {
    color: '#e94560',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  leaguePicksSubtext: {
    color: '#a0a0a0',
    fontSize: 12,
    marginBottom: 12,
  },
  leaguePickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e',
  },
  leaguePickName: {
    color: '#ffffff',
    fontSize: 14,
    flex: 1,
  },
  leaguePickRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  leaguePickCastaway: {
    color: '#a0a0a0',
    fontSize: 13,
    fontWeight: '600',
  },
  noPick: {
    color: '#666',
    fontStyle: 'italic',
  },
  pickStatusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  currentUserRow: {
    backgroundColor: 'rgba(233, 69, 96, 0.08)',
  },
  currentUserName: {
    color: '#e94560',
  },
});

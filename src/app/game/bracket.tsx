import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/useAuthStore';
import {
  getCastaways,
  getCastawaysAliveAtEpisode,
  getActiveSeason,
  getLeague,
  getEpisodeByNumber,
  saveBracketPicks,
  getBracketPicks,
  getLeagueMembers,
} from '../../services/supabase/queries';
import { isBracketLocked, isEpisodeLocked } from '../../core/locks';
import type { Castaway } from '../../core/types';

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ---------- Sub-Components ----------

/** Progress bar showing bracket completion with milestone markers */
function BracketProgress({
  filled,
  total,
}: {
  filled: number;
  total: number;
}) {
  const pct = total > 0 ? filled / total : 0;

  // Milestone positions (0-indexed): Final 3 ~position 15, Winner = 17
  const milestones =
    total > 0
      ? [
          { position: total - 3, label: 'Final 3' },
          { position: total - 1, label: 'Winner' },
        ]
      : [];

  return (
    <View style={progressStyles.container}>
      <View style={progressStyles.labelRow}>
        <Text style={progressStyles.count}>
          {filled}/{total} picked
        </Text>
        {filled === total && total > 0 && (
          <Text style={progressStyles.complete}>✓ Complete!</Text>
        )}
      </View>
      <View style={progressStyles.track}>
        <View
          style={[progressStyles.fill, { width: `${Math.min(pct * 100, 100)}%` }]}
        />
        {milestones.map((m) => {
          const left = ((m.position + 1) / total) * 100;
          const reached = filled > m.position;
          return (
            <View
              key={m.label}
              style={[progressStyles.milestone, { left: `${left}%` }]}
            >
              <View
                style={[
                  progressStyles.milestoneDot,
                  reached && progressStyles.milestoneDotReached,
                ]}
              />
              <Text
                style={[
                  progressStyles.milestoneLabel,
                  reached && progressStyles.milestoneLabelReached,
                ]}
              >
                {m.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** Bottom sheet for editing a picked castaway's position */
function EditPickSheet({
  visible,
  castaway,
  currentPosition,
  totalPicked,
  positionOffset = 0,
  onMoveToPosition,
  onSwapWith,
  onRemove,
  onClose,
}: {
  visible: boolean;
  castaway: Castaway | null;
  currentPosition: number; // 0-indexed in the picked array
  totalPicked: number;
  positionOffset?: number;
  onMoveToPosition: (fromIndex: number, toIndex: number) => void;
  onSwapWith: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [showPositionPicker, setShowPositionPicker] = useState(false);

  // Reset position picker when sheet opens/closes
  useEffect(() => {
    if (!visible) setShowPositionPicker(false);
  }, [visible]);

  if (!castaway) return null;

  const positionLabel = `#${currentPosition + 1 + positionOffset} out`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={sheetStyles.overlay} onPress={onClose}>
        <Pressable
          style={sheetStyles.sheet}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Drag handle */}
          <View style={sheetStyles.handle} />

          {/* Header: castaway info */}
          <View style={sheetStyles.header}>
            {castaway.photo_url ? (
              <Image
                source={{ uri: castaway.photo_url }}
                style={sheetStyles.photo}
              />
            ) : (
              <View style={sheetStyles.photoPlaceholder}>
                <Ionicons name="person" size={22} color="#666" />
              </View>
            )}
            <View style={sheetStyles.headerInfo}>
              <Text style={sheetStyles.name}>{castaway.name}</Text>
              <Text style={sheetStyles.position}>
                Currently: {positionLabel}
              </Text>
            </View>
          </View>

          {!showPositionPicker ? (
            <View style={sheetStyles.actions}>
              {/* Quick Move Up/Down */}
              <View style={sheetStyles.quickMoveRow}>
                <Pressable
                  style={[
                    sheetStyles.quickBtn,
                    currentPosition === 0 && sheetStyles.quickBtnDisabled,
                  ]}
                  onPress={() => {
                    if (currentPosition > 0) {
                      const from = currentPosition;
                      const to = currentPosition - 1;
                      onClose();
                      setTimeout(() => onMoveToPosition(from, to), 300);
                    }
                  }}
                  disabled={currentPosition === 0}
                >
                  <Ionicons
                    name="arrow-up"
                    size={16}
                    color={currentPosition === 0 ? '#444' : '#fff'}
                  />
                  <Text
                    style={[
                      sheetStyles.quickBtnText,
                      currentPosition === 0 && sheetStyles.quickBtnTextDisabled,
                    ]}
                  >
                    Move Up
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    sheetStyles.quickBtn,
                    currentPosition >= totalPicked - 1 &&
                      sheetStyles.quickBtnDisabled,
                  ]}
                  onPress={() => {
                    if (currentPosition < totalPicked - 1) {
                      const from = currentPosition;
                      const to = currentPosition + 1;
                      onClose();
                      setTimeout(() => onMoveToPosition(from, to), 300);
                    }
                  }}
                  disabled={currentPosition >= totalPicked - 1}
                >
                  <Ionicons
                    name="arrow-down"
                    size={16}
                    color={
                      currentPosition >= totalPicked - 1 ? '#444' : '#fff'
                    }
                  />
                  <Text
                    style={[
                      sheetStyles.quickBtnText,
                      currentPosition >= totalPicked - 1 &&
                        sheetStyles.quickBtnTextDisabled,
                    ]}
                  >
                    Move Down
                  </Text>
                </Pressable>
              </View>

              {/* Move to specific position */}
              <Pressable
                style={sheetStyles.actionButton}
                onPress={() => setShowPositionPicker(true)}
              >
                <Ionicons name="swap-vertical" size={22} color="#e94560" />
                <View style={sheetStyles.actionTextArea}>
                  <Text style={sheetStyles.actionText}>
                    Move to position...
                  </Text>
                  <Text style={sheetStyles.actionHint}>
                    Jump to any slot in your bracket
                  </Text>
                </View>
              </Pressable>

              {/* Swap with another */}
              {totalPicked > 1 && (
                <Pressable
                  style={sheetStyles.actionButton}
                  onPress={() => {
                    onClose();
                    // Small delay so sheet closes before swap mode activates
                    setTimeout(onSwapWith, 200);
                  }}
                >
                  <Ionicons name="repeat-outline" size={22} color="#e94560" />
                  <View style={sheetStyles.actionTextArea}>
                    <Text style={sheetStyles.actionText}>
                      Swap with another pick
                    </Text>
                    <Text style={sheetStyles.actionHint}>
                      Exchange positions with any other pick
                    </Text>
                  </View>
                </Pressable>
              )}

              {/* Remove */}
              <Pressable
                style={sheetStyles.actionButton}
                onPress={() => {
                  onClose();
                  setTimeout(onRemove, 200);
                }}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={22}
                  color="#e94560"
                />
                <View style={sheetStyles.actionTextArea}>
                  <Text style={sheetStyles.actionText}>
                    Remove from bracket
                  </Text>
                  <Text style={sheetStyles.actionHint}>
                    Return to available pool, others shift up
                  </Text>
                </View>
              </Pressable>
            </View>
          ) : (
            /* Position picker grid */
            <View style={sheetStyles.positionPicker}>
              <Text style={sheetStyles.pickerTitle}>
                Move to which position?
              </Text>
              <View style={sheetStyles.positionGrid}>
                {Array.from({ length: totalPicked }, (_, i) => {
                  const isCurrent = i === currentPosition;
                  return (
                    <Pressable
                      key={i}
                      style={[
                        sheetStyles.positionCell,
                        isCurrent && sheetStyles.positionCellCurrent,
                      ]}
                      onPress={() => {
                        if (!isCurrent) {
                          const from = currentPosition;
                          const to = i;
                          onClose();
                          setTimeout(() => onMoveToPosition(from, to), 300);
                        }
                      }}
                      disabled={isCurrent}
                    >
                      <Text
                        style={[
                          sheetStyles.positionCellText,
                          isCurrent && sheetStyles.positionCellTextCurrent,
                        ]}
                      >
                        {i + 1}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                style={sheetStyles.backButton}
                onPress={() => setShowPositionPicker(false)}
              >
                <Text style={sheetStyles.backButtonText}>Back</Text>
              </Pressable>
            </View>
          )}

          {/* Cancel */}
          <Pressable style={sheetStyles.cancelButton} onPress={onClose}>
            <Text style={sheetStyles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Swap mode banner shown at the top when user is in "swap with..." mode */
function SwapModeBanner({
  castaway,
  onCancel,
}: {
  castaway: Castaway;
  onCancel: () => void;
}) {
  return (
    <View style={swapStyles.banner}>
      <Ionicons name="repeat-outline" size={18} color="#fff" />
      <Text style={swapStyles.text} numberOfLines={1}>
        Tap another pick to swap with{' '}
        <Text style={swapStyles.name}>{castaway.name}</Text>
      </Text>
      <Pressable onPress={onCancel} hitSlop={12}>
        <Text style={swapStyles.cancel}>Cancel</Text>
      </Pressable>
    </View>
  );
}

// ---------- Main Screen ----------

export default function BracketScreen() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>();
  const user = useAuthStore((s) => s.user);
  const [castaways, setCastaways] = useState<Castaway[]>([]);
  const [pickedIds, setPickedIds] = useState<number[]>([]);
  const [savedPickedIds, setSavedPickedIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const [positionOffset, setPositionOffset] = useState(0);

  // Member viewing state (when locked)
  const [leagueMembers, setLeagueMembers] = useState<
    { user_id: string; username: string; display_name: string | null }[]
  >([]);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [viewingPickedIds, setViewingPickedIds] = useState<number[]>([]);

  // Edit/swap state
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [swapSourceIndex, setSwapSourceIndex] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

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

      // Determine lock time based on start episode
      let locked = false;
      if (startEp === 1) {
        locked = isBracketLocked(season.premiere_date);
      } else {
        const episode = await getEpisodeByNumber(season.id, startEp);
        locked = episode ? isEpisodeLocked(episode.air_date) : true;
      }
      setIsLocked(locked);

      // Load castaways — filter to alive at start episode if mid-season
      let bracketCastaways: Castaway[];
      if (startEp > 1) {
        bracketCastaways = await getCastawaysAliveAtEpisode(season.id, startEp);
        const fullCast = await getCastaways(season.id);
        setPositionOffset(fullCast.length - bracketCastaways.length);
      } else {
        bracketCastaways = await getCastaways(season.id);
      }
      setCastaways(bracketCastaways);

      if (leagueId && user) {
        const existing = await getBracketPicks(leagueId, user.id);
        if (existing.length > 0) {
          const savedOrder = existing
            .sort((a, b) => a.predicted_position - b.predicted_position)
            .map((p) => p.castaway_id);
          setPickedIds(savedOrder);
          setSavedPickedIds(savedOrder);
        }
      }

      // Fetch league members when locked (for viewing others' brackets)
      if (locked && leagueId) {
        const members = await getLeagueMembers(leagueId);
        setLeagueMembers(members);
      }
    } catch {
      Alert.alert('Error', 'Failed to load bracket data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const castawayMap = useMemo(() => {
    const map = new Map<number, Castaway>();
    for (const c of castaways) map.set(c.id, c);
    return map;
  }, [castaways]);

  // When viewing another member's bracket, use their picks for display
  const displayPickedIds = viewingUserId ? viewingPickedIds : pickedIds;
  const viewingMember = viewingUserId
    ? leagueMembers.find((m) => m.user_id === viewingUserId)
    : null;

  const pickedSet = useMemo(() => new Set(pickedIds), [pickedIds]);

  const available = useMemo(
    () => castaways.filter((c) => !pickedSet.has(c.id)),
    [castaways, pickedSet],
  );

  const totalCastaways = castaways.length;
  const allPicked =
    pickedIds.length === totalCastaways && totalCastaways > 0;

  const hasUnsavedChanges = allPicked &&
    (savedPickedIds.length === 0 ||
     pickedIds.some((id, i) => id !== savedPickedIds[i]));

  // --- CORE ACTIONS ---

  /** Tap an available castaway to add to the next bracket slot */
  const handlePick = useCallback(
    (id: number) => {
      if (isLocked) return;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setPickedIds((prev) => [...prev, id]);
    },
    [isLocked],
  );

  /** Tap a picked castaway: if in swap mode, swap; otherwise open edit sheet */
  const handlePickedTap = useCallback(
    (index: number) => {
      if (isLocked) return;

      if (swapSourceIndex !== null) {
        // Complete the swap
        if (index !== swapSourceIndex) {
          LayoutAnimation.configureNext(
            LayoutAnimation.Presets.easeInEaseOut,
          );
          setPickedIds((prev) => {
            const next = [...prev];
            const temp = next[swapSourceIndex];
            next[swapSourceIndex] = next[index];
            next[index] = temp;
            return next;
          });
        }
        setSwapSourceIndex(null);
      } else {
        // Open edit sheet
        setEditingIndex(index);
      }
    },
    [isLocked, swapSourceIndex],
  );

  /** Move a castaway from one position to another (insert, not swap) */
  const handleMoveToPosition = useCallback(
    (fromIndex: number, toIndex: number) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setPickedIds((prev) => {
        const next = [...prev];
        const [removed] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, removed);
        return next;
      });
    },
    [],
  );

  /** Enter swap mode: user will tap another pick to swap with */
  const handleEnterSwapMode = useCallback(() => {
    if (editingIndex === null) return;
    setSwapSourceIndex(editingIndex);
    setEditingIndex(null);
  }, [editingIndex]);

  /** Remove a single pick, shifting everything below it up */
  const handleRemovePick = useCallback(() => {
    if (editingIndex === null) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPickedIds((prev) => prev.filter((_, i) => i !== editingIndex));
    setEditingIndex(null);
  }, [editingIndex]);

  const handleClearAll = () => {
    if (isLocked) return;
    Alert.alert('Clear Bracket', 'Remove all picks and start over?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          LayoutAnimation.configureNext(
            LayoutAnimation.Presets.easeInEaseOut,
          );
          setPickedIds([]);
          setSwapSourceIndex(null);
        },
      },
    ]);
  };

  const handleSave = async () => {
    if (!leagueId || !user || isLocked || !allPicked) return;

    setIsSaving(true);
    try {
      const picks = pickedIds.map((castawayId, index) => ({
        castaway_id: castawayId,
        predicted_position: index + 1 + positionOffset,
      }));

      await saveBracketPicks(leagueId, user.id, picks);
      setSavedPickedIds([...pickedIds]);
      Alert.alert(
        'Bracket Saved!',
        positionOffset > 0
          ? 'Your elimination bracket has been saved. You can update it until the start episode airs.'
          : 'Your elimination bracket has been saved. You can update it until the season premiere.',
      );
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save bracket.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleViewMember = useCallback(
    async (userId: string | null) => {
      if (!userId || userId === user?.id) {
        setViewingUserId(null);
        setViewingPickedIds([]);
        return;
      }
      setViewingUserId(userId);
      try {
        const picks = await getBracketPicks(leagueId!, userId);
        const order = picks
          .sort((a, b) => a.predicted_position - b.predicted_position)
          .map((p) => p.castaway_id);
        setViewingPickedIds(order);
      } catch {
        setViewingUserId(null);
        setViewingPickedIds([]);
      }
    },
    [leagueId, user?.id],
  );

  const getPositionLabel = (index: number): string => {
    const globalPos = index + 1 + positionOffset;
    const totalGlobal = totalCastaways + positionOffset;
    if (totalGlobal > 0 && globalPos === totalGlobal) return 'SOLE SURVIVOR';
    if (totalGlobal > 1 && globalPos === totalGlobal - 1) return 'Runner-up';
    if (totalGlobal > 2 && globalPos === totalGlobal - 2) return 'Final 3';
    return `#${globalPos} out`;
  };

  // --- SECTION DATA ---

  type SectionItem =
    | { type: 'picked'; castawayId: number; index: number }
    | { type: 'next_slot' }
    | { type: 'available'; castaway: Castaway };

  const sections = useMemo(() => {
    const bracketItems: SectionItem[] = displayPickedIds.map((id, index) => ({
      type: 'picked' as const,
      castawayId: id,
      index,
    }));

    if (!allPicked && !isLocked) {
      bracketItems.push({ type: 'next_slot' as const });
    }

    const bracketTitle = viewingMember
      ? `${(viewingMember.display_name ?? viewingMember.username).toUpperCase()}'S BRACKET (${displayPickedIds.length}/${totalCastaways})`
      : `YOUR BRACKET (${displayPickedIds.length}/${totalCastaways})`;

    const result: { title: string; data: SectionItem[] }[] = [
      {
        title: bracketTitle,
        data:
          bracketItems.length > 0
            ? bracketItems
            : [{ type: 'next_slot' as const }],
      },
    ];

    if (!isLocked && available.length > 0) {
      result.push({
        title: allPicked
          ? 'ALL CASTAWAYS PICKED'
          : `TAP TO PICK #${pickedIds.length + 1 + positionOffset} OUT`,
        data: available.map((c) => ({
          type: 'available' as const,
          castaway: c,
        })),
      });
    }

    return result;
  }, [displayPickedIds, pickedIds, available, allPicked, isLocked, totalCastaways, viewingMember]);

  // Editing castaway for the sheet
  const editingCastaway =
    editingIndex !== null
      ? castawayMap.get(pickedIds[editingIndex]) ?? null
      : null;

  // Swap source castaway for the banner
  const swapSourceCastaway =
    swapSourceIndex !== null
      ? castawayMap.get(pickedIds[swapSourceIndex]) ?? null
      : null;

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Swap mode banner */}
      {swapSourceCastaway && (
        <SwapModeBanner
          castaway={swapSourceCastaway}
          onCancel={() => setSwapSourceIndex(null)}
        />
      )}

      {/* Progress bar */}
      <BracketProgress filled={displayPickedIds.length} total={totalCastaways} />

      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionText}>
          {isLocked
            ? viewingMember
              ? `Viewing ${viewingMember.display_name ?? viewingMember.username}'s bracket`
              : 'Brackets are locked. Good luck this season!'
            : pickedIds.length === 0
              ? "Tap castaways in the order you think they'll be eliminated"
              : allPicked
                ? 'All set! Review your bracket and save.'
                : `Pick who goes out #${pickedIds.length + 1 + positionOffset}`}
        </Text>
        {!isLocked && pickedIds.length > 0 && (
          <Pressable onPress={handleClearAll} hitSlop={8}>
            <Text style={styles.clearText}>Clear All</Text>
          </Pressable>
        )}
      </View>

      {/* Member selector (only when locked with multiple members) */}
      {isLocked && leagueMembers.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.memberSelector}
        >
          <Pressable
            style={[
              styles.memberChip,
              !viewingUserId && styles.memberChipActive,
            ]}
            onPress={() => {
              setViewingUserId(null);
              setViewingPickedIds([]);
            }}
          >
            <Text
              style={[
                styles.memberChipText,
                !viewingUserId && styles.memberChipTextActive,
              ]}
            >
              You
            </Text>
          </Pressable>
          {leagueMembers
            .filter((m) => m.user_id !== user?.id)
            .map((m) => (
              <Pressable
                key={m.user_id}
                style={[
                  styles.memberChip,
                  viewingUserId === m.user_id && styles.memberChipActive,
                ]}
                onPress={() => handleViewMember(m.user_id)}
              >
                <Text
                  style={[
                    styles.memberChipText,
                    viewingUserId === m.user_id && styles.memberChipTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {m.display_name ?? m.username}
                </Text>
              </Pressable>
            ))}
        </ScrollView>
      )}

      <SectionList
        sections={sections}
        keyExtractor={(item) => {
          if (item.type === 'picked') return `picked-${item.castawayId}`;
          if (item.type === 'next_slot') return 'next-slot';
          return `avail-${item.castaway.id}`;
        }}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => {
          if (item.type === 'picked') {
            const castaway = castawayMap.get(item.castawayId);
            if (!castaway) return null;
            const isWinner =
              totalCastaways > 0 && item.index === totalCastaways - 1;
            const isSwapSource = item.index === swapSourceIndex;
            const isSwapTarget =
              swapSourceIndex !== null && !isSwapSource;
            const label = getPositionLabel(item.index);

            return (
              <Pressable
                style={[
                  styles.pickedRow,
                  isWinner && styles.winnerRow,
                  isSwapSource && styles.swapSourceRow,
                  isSwapTarget && styles.swapTargetRow,
                ]}
                onPress={() => handlePickedTap(item.index)}
                disabled={isLocked}
              >
                <View
                  style={[
                    styles.positionBadge,
                    isWinner && styles.winnerBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.positionNumber,
                      isWinner && styles.winnerNumber,
                    ]}
                  >
                    {item.index + 1 + positionOffset}
                  </Text>
                </View>
                {castaway.photo_url ? (
                  <Image
                    source={{ uri: castaway.photo_url }}
                    style={styles.photo}
                  />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="person" size={16} color="#666" />
                  </View>
                )}
                <View style={styles.pickedInfo}>
                  <Text
                    style={[
                      styles.pickedName,
                      isWinner && styles.winnerName,
                    ]}
                  >
                    {castaway.name}
                  </Text>
                  <Text
                    style={[
                      styles.positionLabel,
                      isWinner && styles.winnerLabel,
                    ]}
                  >
                    {label}
                  </Text>
                </View>
                {!isLocked && !swapSourceIndex && (
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={20}
                    color="#666"
                  />
                )}
                {isSwapTarget && (
                  <Ionicons
                    name="repeat-outline"
                    size={20}
                    color="#e94560"
                  />
                )}
                {isSwapSource && (
                  <View style={styles.swapSourceBadge}>
                    <Text style={styles.swapSourceBadgeText}>Selected</Text>
                  </View>
                )}
              </Pressable>
            );
          }

          if (item.type === 'next_slot') {
            return (
              <View style={styles.nextSlotRow}>
                <View style={styles.nextSlotBadge}>
                  <Text style={styles.nextSlotNumber}>
                    {pickedIds.length + 1 + positionOffset}
                  </Text>
                </View>
                <View style={styles.nextSlotDashed}>
                  <Ionicons name="arrow-down" size={16} color="#e94560" />
                  <Text style={styles.nextSlotText}>
                    {pickedIds.length === 0
                      ? 'Tap a castaway below to start'
                      : `Pick #${pickedIds.length + 1 + positionOffset} out`}
                  </Text>
                </View>
              </View>
            );
          }

          // Available castaway
          const { castaway } = item;
          return (
            <Pressable
              style={[
                styles.availableRow,
                !!swapSourceIndex && styles.availableRowDisabled,
              ]}
              onPress={() => handlePick(castaway.id)}
              disabled={!!swapSourceIndex}
            >
              {castaway.photo_url ? (
                <Image
                  source={{ uri: castaway.photo_url }}
                  style={styles.photo}
                />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="person" size={16} color="#666" />
                </View>
              )}
              <View style={styles.availableInfo}>
                <Text style={styles.availableName}>{castaway.name}</Text>
                {castaway.tribe && (
                  <Text style={styles.tribe}>{castaway.tribe}</Text>
                )}
              </View>
              <Ionicons
                name="add-circle-outline"
                size={24}
                color={swapSourceIndex ? '#333' : '#e94560'}
              />
            </Pressable>
          );
        }}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled
      />

      {/* Save button */}
      {!isLocked && allPicked && (
        <Pressable
          style={[styles.saveButton, (!hasUnsavedChanges || isSaving) && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={!hasUnsavedChanges || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>
              {hasUnsavedChanges ? 'Save Bracket' : 'Bracket Saved'}
            </Text>
          )}
        </Pressable>
      )}

      {/* Edit pick bottom sheet */}
      <EditPickSheet
        visible={editingIndex !== null}
        castaway={editingCastaway}
        currentPosition={editingIndex ?? 0}
        totalPicked={pickedIds.length}
        positionOffset={positionOffset}
        onMoveToPosition={handleMoveToPosition}
        onSwapWith={handleEnterSwapMode}
        onRemove={handleRemovePick}
        onClose={() => setEditingIndex(null)}
      />
    </View>
  );
}

// ---------- Styles ----------

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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#1a1a2e',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e',
  },
  instructionText: {
    color: '#a0a0a0',
    fontSize: 14,
    flex: 1,
  },
  clearText: {
    color: '#e94560',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 12,
  },
  listContent: {
    paddingBottom: 100,
  },
  sectionHeader: {
    backgroundColor: '#0f0f23',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  sectionTitle: {
    color: '#e94560',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Picked rows
  pickedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#12122a',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  winnerRow: {
    backgroundColor: '#1a1025',
    borderBottomColor: '#2a1a3e',
  },
  swapSourceRow: {
    backgroundColor: '#1e1040',
    borderWidth: 1,
    borderColor: '#e94560',
  },
  swapTargetRow: {
    backgroundColor: '#15152e',
  },
  positionBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#16213e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  winnerBadge: {
    backgroundColor: '#e94560',
  },
  positionNumber: {
    color: '#a0a0a0',
    fontSize: 12,
    fontWeight: 'bold',
  },
  winnerNumber: {
    color: '#fff',
  },
  photo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    backgroundColor: '#16213e',
  },
  photoPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    backgroundColor: '#16213e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickedInfo: {
    flex: 1,
  },
  pickedName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  winnerName: {
    color: '#e94560',
  },
  positionLabel: {
    color: '#666',
    fontSize: 11,
    marginTop: 1,
  },
  winnerLabel: {
    color: '#e94560',
    fontWeight: '600',
  },
  swapSourceBadge: {
    backgroundColor: '#e94560',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  swapSourceBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Next slot indicator
  nextSlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  nextSlotBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#e94560',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  nextSlotNumber: {
    color: '#e94560',
    fontSize: 12,
    fontWeight: 'bold',
  },
  nextSlotDashed: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nextSlotText: {
    color: '#e94560',
    fontSize: 14,
    fontStyle: 'italic',
  },

  // Available rows
  availableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  availableRowDisabled: {
    opacity: 0.4,
  },
  availableInfo: {
    flex: 1,
  },
  availableName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  tribe: {
    color: '#a0a0a0',
    fontSize: 11,
    marginTop: 1,
  },

  // Member selector
  memberSelector: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#1a1a2e',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e',
  },
  memberChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#16213e',
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  memberChipActive: {
    backgroundColor: '#e94560',
    borderColor: '#e94560',
  },
  memberChipText: {
    color: '#a0a0a0',
    fontSize: 13,
    fontWeight: '600',
  },
  memberChipTextActive: {
    color: '#ffffff',
  },

  // Save button
  saveButton: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: '#e94560',
    borderRadius: 12,
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

const progressStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    backgroundColor: '#0f0f23',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  count: {
    color: '#a0a0a0',
    fontSize: 13,
    fontWeight: '600',
  },
  complete: {
    color: '#4ecdc4',
    fontSize: 13,
    fontWeight: '700',
  },
  track: {
    height: 6,
    backgroundColor: '#16213e',
    borderRadius: 3,
    overflow: 'visible',
    position: 'relative',
  },
  fill: {
    height: 6,
    backgroundColor: '#e94560',
    borderRadius: 3,
  },
  milestone: {
    position: 'absolute',
    top: -5,
    alignItems: 'center',
    transform: [{ translateX: -7 }],
  },
  milestoneDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#16213e',
    borderWidth: 2,
    borderColor: '#2a2a4e',
  },
  milestoneDotReached: {
    backgroundColor: '#e94560',
    borderColor: '#e94560',
  },
  milestoneLabel: {
    color: '#444',
    fontSize: 9,
    marginTop: 3,
    fontWeight: '600',
  },
  milestoneLabelReached: {
    color: '#e94560',
  },
});

const sheetStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#333',
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  photo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 14,
    backgroundColor: '#16213e',
  },
  photoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 14,
    backgroundColor: '#16213e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  name: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  position: {
    color: '#a0a0a0',
    fontSize: 13,
    marginTop: 2,
  },
  actions: {
    gap: 2,
  },
  quickMoveRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#16213e',
    paddingVertical: 12,
    borderRadius: 10,
  },
  quickBtnDisabled: {
    backgroundColor: '#111',
    opacity: 0.4,
  },
  quickBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  quickBtnTextDisabled: {
    color: '#444',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e',
  },
  actionTextArea: {
    flex: 1,
  },
  actionText: {
    color: '#ffffff',
    fontSize: 16,
  },
  actionHint: {
    color: '#555',
    fontSize: 12,
    marginTop: 1,
  },
  positionPicker: {
    alignItems: 'center',
  },
  pickerTitle: {
    color: '#a0a0a0',
    fontSize: 14,
    marginBottom: 16,
    fontWeight: '600',
  },
  positionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  positionCell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#16213e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  positionCellCurrent: {
    backgroundColor: '#e94560',
  },
  positionCellText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  positionCellTextCurrent: {
    color: '#fff',
  },
  backButton: {
    marginTop: 16,
    paddingVertical: 8,
  },
  backButtonText: {
    color: '#e94560',
    fontSize: 15,
    fontWeight: '600',
  },
  cancelButton: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelText: {
    color: '#666',
    fontSize: 16,
  },
});

const swapStyles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#e94560',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  name: {
    fontWeight: '700',
  },
  cancel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});

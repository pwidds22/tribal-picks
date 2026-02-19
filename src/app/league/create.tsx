import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/useAuthStore';
import { useLeagueStore } from '../../stores/useLeagueStore';
import { createLeague, getActiveSeason } from '../../services/supabase/queries';
import type { GameType } from '../../core/types';

// ---------- Game Type Data ----------

type GameTypeOption = {
  value: GameType;
  label: string;
  tagline: string;
  icon: keyof typeof Ionicons.glyphMap;
  accentColor: string;
  pills: { label: string; color: string; bg: string }[];
  bullets: string[];
  howItWorks: { step: string; detail: string }[];
  strategyTip: string;
  scoringPreview: string[];
};

const GAME_TYPES: GameTypeOption[] = [
  {
    value: 'bracket',
    label: 'Elimination Bracket',
    tagline: 'Lock in your predictions. Watch them play out all season.',
    icon: 'git-branch-outline',
    accentColor: '#e94560',
    pills: [
      { label: 'Beginner Friendly', color: '#4ecdc4', bg: '#0d2e2e' },
      { label: 'Set Once', color: '#74b9ff', bg: '#0d1a2e' },
      { label: 'Season-Long', color: '#a0a0a0', bg: '#1a1a2e' },
    ],
    bullets: [
      'Rank all 18 castaways from first out to Sole Survivor',
      'Earn points at each elimination based on accuracy',
      'Set before premiere, ride it out all season',
    ],
    howItWorks: [
      {
        step: 'Before premiere',
        detail: 'Rank all 18 castaways in your predicted elimination order',
      },
      {
        step: 'Each episode',
        detail:
          'When someone is voted out, you earn points based on how close you predicted their position',
      },
      {
        step: 'At finale',
        detail:
          'Bonus points for nailing the Sole Survivor and endgame predictions',
      },
    ],
    strategyTip:
      'Focus on the extremes — first boot and winner predictions are worth the most bonus points. Endgame positions are 10x more valuable than early boots.',
    scoringPreview: [
      'Exact position = full points',
      'Off by 1 = half points',
      'Off by 2 = quarter points',
      'Off by 3+ = no points',
      'Winner bonus = +15 pts',
      'First boot bonus = +5 pts',
    ],
  },
  {
    value: 'survivor_pool',
    label: 'Survivor Pool',
    tagline: "One wrong pick and you're out. Last one standing wins.",
    icon: 'skull-outline',
    accentColor: '#ffa502',
    pills: [
      { label: 'Strategic', color: '#ffa502', bg: '#2e1a0d' },
      { label: 'Weekly', color: '#ffa502', bg: '#2e2a0d' },
      { label: 'Elimination', color: '#e94560', bg: '#2e0d0d' },
    ],
    bullets: [
      'Pick one castaway to survive each episode',
      "If your pick gets voted out, you're eliminated",
      "Can't reuse castaways — strategy is everything",
    ],
    howItWorks: [
      {
        step: 'Each week',
        detail:
          "Before the episode airs, pick one castaway you think will survive tribal council",
      },
      {
        step: 'After the episode',
        detail:
          "If your pick was voted out, you're eliminated from the pool",
      },
      {
        step: 'Winner',
        detail:
          'Last person standing in the pool wins. If multiple survive to the finale, they share the win.',
      },
    ],
    strategyTip:
      "Save obviously safe castaways (challenge beasts, alliance leaders) for unpredictable episodes. Don't waste a 'sure thing' pick early.",
    scoringPreview: [
      'Correct pick = you survive',
      'Wrong pick = you\'re eliminated',
      'Can\'t reuse any castaway',
      'Last one standing wins',
    ],
  },
];

// ---------- Comparison Table ----------

const COMPARISON_ROWS = [
  {
    label: 'When to play',
    bracket: 'Set before premiere',
    pool: 'Pick each episode',
  },
  {
    label: 'Time per week',
    bracket: '0 min (set & forget)',
    pool: '2 min per episode',
  },
  {
    label: 'Difficulty',
    bracket: 'Easy to start',
    pool: 'Requires strategy',
  },
  {
    label: 'Elimination risk',
    bracket: 'None — play all season',
    pool: 'One wrong pick = out',
  },
  {
    label: 'Best for',
    bracket: 'Casual fans',
    pool: 'Competitive players',
  },
];

// ---------- Sub-Components ----------

function GameTypeCard({
  option,
  selected,
  onSelect,
}: {
  option: GameTypeOption;
  selected: boolean;
  onSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Pressable
      style={[
        cardStyles.container,
        selected && { borderColor: option.accentColor },
        selected && { backgroundColor: '#1a1028' },
      ]}
      onPress={onSelect}
    >
      {/* Header row */}
      <View style={cardStyles.header}>
        <View
          style={[
            cardStyles.iconBox,
            selected && { backgroundColor: option.accentColor },
          ]}
        >
          <Ionicons
            name={option.icon}
            size={20}
            color={selected ? '#fff' : option.accentColor}
          />
        </View>
        <View style={cardStyles.headerText}>
          <Text
            style={[
              cardStyles.label,
              selected && { color: option.accentColor },
            ]}
          >
            {option.label}
          </Text>
          <Text style={cardStyles.tagline}>{option.tagline}</Text>
        </View>
        <View style={[cardStyles.radio, selected && cardStyles.radioSelected]}>
          {selected && <View style={cardStyles.radioDot} />}
        </View>
      </View>

      {/* Pills */}
      <View style={cardStyles.pills}>
        {option.pills.map((pill) => (
          <View
            key={pill.label}
            style={[cardStyles.pill, { backgroundColor: pill.bg }]}
          >
            <Text style={[cardStyles.pillText, { color: pill.color }]}>
              {pill.label}
            </Text>
          </View>
        ))}
      </View>

      {/* Bullet points — always visible */}
      <View style={cardStyles.bullets}>
        {option.bullets.map((bullet, i) => (
          <View key={i} style={cardStyles.bulletRow}>
            <Text style={[cardStyles.bulletDot, { color: option.accentColor }]}>
              {'\u2022'}
            </Text>
            <Text style={cardStyles.bulletText}>{bullet}</Text>
          </View>
        ))}
      </View>

      {/* Expandable detail section */}
      {selected && (
        <View style={cardStyles.expandArea}>
          <Pressable
            style={cardStyles.expandToggle}
            onPress={() => setExpanded(!expanded)}
            hitSlop={8}
          >
            <Text
              style={[
                cardStyles.expandToggleText,
                { color: option.accentColor },
              ]}
            >
              {expanded ? 'Less detail' : 'How it works & scoring'}
            </Text>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={option.accentColor}
            />
          </Pressable>

          {expanded && (
            <View style={cardStyles.expandContent}>
              {/* How it works */}
              <Text style={cardStyles.expandSectionTitle}>HOW IT WORKS</Text>
              {option.howItWorks.map((item, i) => (
                <View key={i} style={cardStyles.stepRow}>
                  <View
                    style={[
                      cardStyles.stepBadge,
                      { backgroundColor: option.accentColor + '30' },
                    ]}
                  >
                    <Text
                      style={[
                        cardStyles.stepBadgeText,
                        { color: option.accentColor },
                      ]}
                    >
                      {i + 1}
                    </Text>
                  </View>
                  <View style={cardStyles.stepContent}>
                    <Text style={cardStyles.stepLabel}>{item.step}</Text>
                    <Text style={cardStyles.stepDetail}>{item.detail}</Text>
                  </View>
                </View>
              ))}

              {/* Scoring preview */}
              <Text
                style={[cardStyles.expandSectionTitle, { marginTop: 14 }]}
              >
                SCORING
              </Text>
              {option.scoringPreview.map((line, i) => (
                <View key={i} style={cardStyles.scoreLine}>
                  <Ionicons
                    name="checkmark-circle"
                    size={14}
                    color={option.accentColor}
                  />
                  <Text style={cardStyles.scoreText}>{line}</Text>
                </View>
              ))}

              {/* Strategy tip */}
              <View style={cardStyles.tipBox}>
                <Ionicons name="bulb-outline" size={16} color="#ffa502" />
                <Text style={cardStyles.tipText}>{option.strategyTip}</Text>
              </View>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

function ComparisonTable() {
  return (
    <View style={tableStyles.container}>
      <Text style={tableStyles.title}>Can't decide?</Text>
      {/* Header */}
      <View style={tableStyles.headerRow}>
        <View style={tableStyles.labelCell} />
        <View style={tableStyles.valueCell}>
          <Ionicons name="git-branch-outline" size={14} color="#e94560" />
          <Text style={[tableStyles.headerText, { color: '#e94560' }]}>
            Bracket
          </Text>
        </View>
        <View style={tableStyles.valueCell}>
          <Ionicons name="skull-outline" size={14} color="#ffa502" />
          <Text style={[tableStyles.headerText, { color: '#ffa502' }]}>
            Pool
          </Text>
        </View>
      </View>
      {/* Rows */}
      {COMPARISON_ROWS.map((row, i) => (
        <View
          key={i}
          style={[
            tableStyles.row,
            i % 2 === 0 && tableStyles.rowAlt,
          ]}
        >
          <View style={tableStyles.labelCell}>
            <Text style={tableStyles.labelText}>{row.label}</Text>
          </View>
          <View style={tableStyles.valueCell}>
            <Text style={tableStyles.valueText}>{row.bracket}</Text>
          </View>
          <View style={tableStyles.valueCell}>
            <Text style={tableStyles.valueText}>{row.pool}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ---------- Main Screen ----------

export default function CreateLeagueScreen() {
  const [name, setName] = useState('');
  const [gameType, setGameType] = useState<GameType>('bracket');
  const [isPublic, setIsPublic] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const user = useAuthStore((s) => s.user);
  const invalidateLeagues = useLeagueStore((s) => s.invalidate);
  const selectedOption = GAME_TYPES.find((g) => g.value === gameType);
  const createLabel = selectedOption
    ? `Create ${selectedOption.label}`
    : 'Create League';

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
        isPublic,
      );

      invalidateLeagues();
      Alert.alert(
        'League Created!',
        `Invite code: ${league.invite_code}\n\nShare this code with friends to join.`,
        [
          {
            text: 'OK',
            onPress: () => {
              router.replace(`/league/${league.id}`);
            },
          },
        ],
      );
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      {/* League Name */}
      <Text style={styles.label}>League Name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., Tribal Council Legends"
        placeholderTextColor="#666"
        value={name}
        onChangeText={setName}
        maxLength={40}
      />

      {/* Game Type */}
      <Text style={styles.label}>Game Type</Text>
      {GAME_TYPES.map((gt) => (
        <GameTypeCard
          key={gt.value}
          option={gt}
          selected={gameType === gt.value}
          onSelect={() => setGameType(gt.value)}
        />
      ))}

      {/* Comparison table */}
      <ComparisonTable />

      {/* Public toggle */}
      <Pressable
        style={styles.toggleRow}
        onPress={() => setIsPublic(!isPublic)}
      >
        <View>
          <Text style={styles.toggleLabel}>Public League</Text>
          <Text style={styles.toggleHint}>Anyone can find and join</Text>
        </View>
        <View style={[styles.toggle, isPublic && styles.toggleActive]}>
          <View
            style={[styles.toggleDot, isPublic && styles.toggleDotActive]}
          />
        </View>
      </Pressable>

      {/* Create Button — text reflects selected game type */}
      <Pressable
        style={[
          styles.createButton,
          isLoading && styles.buttonDisabled,
          selectedOption && {
            backgroundColor: selectedOption.accentColor,
          },
        ]}
        onPress={handleCreate}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.createButtonText}>{createLabel}</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

// ---------- Styles ----------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 16,
    color: '#e94560',
  },
  input: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },

  // Toggle
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
  toggleHint: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
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

  // Create button
  createButton: {
    backgroundColor: '#e94560',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
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

const cardStyles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#2a2a4e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#16213e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerText: {
    flex: 1,
  },
  label: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tagline: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 1,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#2a2a4e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: '#e94560',
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e94560',
  },

  // Pills
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
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

  // Bullets (always visible)
  bullets: {
    gap: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 8,
  },
  bulletDot: {
    fontSize: 14,
    lineHeight: 18,
  },
  bulletText: {
    color: '#a0a0a0',
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },

  // Expand area
  expandArea: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a4e',
    paddingTop: 10,
  },
  expandToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  expandToggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  expandContent: {
    marginTop: 12,
    gap: 6,
  },
  expandSectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#e94560',
    letterSpacing: 1,
    marginBottom: 6,
  },

  // How it works steps
  stepRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  stepContent: {
    flex: 1,
  },
  stepLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ddd',
  },
  stepDetail: {
    fontSize: 12,
    color: '#888',
    lineHeight: 17,
    marginTop: 1,
  },

  // Scoring preview
  scoreLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  scoreText: {
    fontSize: 12,
    color: '#a0a0a0',
  },

  // Strategy tip
  tipBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#1a1a0d',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#2a2a14',
  },
  tipText: {
    fontSize: 12,
    color: '#cca',
    lineHeight: 17,
    flex: 1,
  },
});

const tableStyles = StyleSheet.create({
  container: {
    marginTop: 16,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    padding: 12,
    paddingBottom: 0,
  },
  headerRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e',
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rowAlt: {
    backgroundColor: '#16182e',
  },
  labelCell: {
    flex: 1.2,
    justifyContent: 'center',
  },
  labelText: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
  valueCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerText: {
    fontSize: 11,
    fontWeight: '700',
  },
  valueText: {
    fontSize: 11,
    color: '#ccc',
    lineHeight: 15,
  },
});

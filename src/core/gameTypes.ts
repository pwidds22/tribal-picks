import type { GameType } from './types';

export const GAME_TYPE_META = {
  bracket: {
    label: 'Elimination Bracket',
    icon: 'git-branch-outline',
    accentColor: '#e94560',
  },
  survivor_pool: {
    label: 'Survivor Pool',
    icon: 'skull-outline',
    accentColor: '#ffa502',
  },
  draft: {
    label: 'Cast Draft',
    icon: 'swap-horizontal-outline',
    accentColor: '#4ecdc4',
  },
  weekly: {
    label: "Weekly Pick'em",
    icon: 'calendar-outline',
    accentColor: '#a29bfe',
  },
} as const satisfies Record<GameType, { label: string; icon: string; accentColor: string }>;

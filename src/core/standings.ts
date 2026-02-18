import type { LeaderboardEntry, SurvivorPoolStandingEntry } from './types';

/**
 * Assign ranks to bracket standings (pre-sorted by total_points DESC).
 * Ties get the same rank (1, 1, 3 style).
 */
export function assignBracketRanks(
  entries: Omit<LeaderboardEntry, 'rank'>[]
): LeaderboardEntry[] {
  const ranked: LeaderboardEntry[] = [];
  let currentRank = 1;

  for (let i = 0; i < entries.length; i++) {
    if (i > 0 && entries[i].total_points < entries[i - 1].total_points) {
      currentRank = i + 1;
    }
    ranked.push({ ...entries[i], rank: currentRank });
  }

  return ranked;
}

/**
 * Assign ranks to survivor pool standings.
 * Alive players tied at #1, eliminated ranked by episode DESC (later = higher).
 */
export function assignSurvivorPoolRanks(
  entries: Omit<SurvivorPoolStandingEntry, 'rank'>[]
): SurvivorPoolStandingEntry[] {
  // Sort: alive first, then by eliminated_in_episode DESC
  const sorted = [...entries].sort((a, b) => {
    if (a.is_alive && !b.is_alive) return -1;
    if (!a.is_alive && b.is_alive) return 1;
    if (a.is_alive && b.is_alive) return 0;
    // Both eliminated: later episode = better rank
    const aEp = a.eliminated_in_episode ?? 0;
    const bEp = b.eliminated_in_episode ?? 0;
    return bEp - aEp;
  });

  const ranked: SurvivorPoolStandingEntry[] = [];
  let currentRank = 1;

  for (let i = 0; i < sorted.length; i++) {
    if (i > 0) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const sameStatus =
        prev.is_alive === curr.is_alive &&
        prev.eliminated_in_episode === curr.eliminated_in_episode;
      if (!sameStatus) {
        currentRank = i + 1;
      }
    }
    ranked.push({ ...sorted[i], rank: currentRank });
  }

  return ranked;
}

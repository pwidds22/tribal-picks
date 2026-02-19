import {
  BRACKET_POSITION_VALUES,
  BRACKET_ACCURACY,
  BRACKET_BONUSES,
  DRAFT_SCORING,
  WEEKLY_SCORING,
  type BracketPick,
  type WeeklyPick,
} from './types';

// ============================================
// Pure scoring functions — no side effects
// NOTE: These functions are duplicated in the Supabase Edge Function
// `sync-results/index.ts` for server-side scoring. Keep both in sync!
// ============================================

/**
 * Get the base point value for a given elimination position.
 * Later positions (endgame) are worth significantly more.
 *
 * Falls back to a calculated value for non-18 castaway seasons.
 */
export function getPositionBaseValue(
  position: number,
  totalCastaways: number = 18,
): number {
  // For standard 18-castaway season, use the lookup table
  if (totalCastaways === 18 && BRACKET_POSITION_VALUES[position]) {
    return BRACKET_POSITION_VALUES[position];
  }

  // Dynamic calculation for non-standard cast sizes:
  // Linearly scale from 2 (first out) to 20 (winner)
  const ratio = (position - 1) / Math.max(totalCastaways - 1, 1);
  return Math.round(2 + ratio * 18);
}

/**
 * Get the accuracy multiplier based on prediction distance.
 */
export function getAccuracyMultiplier(distance: number): number {
  if (distance === 0) return BRACKET_ACCURACY.EXACT;
  if (distance === 1) return BRACKET_ACCURACY.OFF_BY_1;
  if (distance === 2) return BRACKET_ACCURACY.OFF_BY_2;
  return BRACKET_ACCURACY.OFF_BY_3_PLUS;
}

/**
 * Score a single bracket pick using the escalating position-value system.
 *
 * Points = baseValue(actualPosition) * accuracyMultiplier(distance)
 *
 * - Exact match on position 18 (winner) = 20 * 1.0 = 20 pts
 * - Off by 1 on position 18 = 20 * 0.5 = 10 pts
 * - Off by 3+ on any position = 0 pts
 * - Exact match on position 1 (first boot) = 2 * 1.0 = 2 pts
 */
export function scoreBracketPick(
  predictedPosition: number,
  actualPosition: number,
  totalCastaways: number = 18,
): number {
  const distance = Math.abs(predictedPosition - actualPosition);
  const baseValue = getPositionBaseValue(actualPosition, totalCastaways);
  const multiplier = getAccuracyMultiplier(distance);

  return Math.round(baseValue * multiplier);
}

/**
 * Score a full bracket (all picks for one user in one league).
 * Includes milestone bonuses for exceptional predictions.
 *
 * Scoring breakdown for 18-castaway season:
 * - Position points: sum of (baseValue * accuracy) for each scored pick
 * - Sole Survivor exact:     +15 bonus
 * - Perfect endgame (14-18): +10 bonus (all 5 exact)
 * - First boot exact:         +5 bonus
 *
 * Max possible: 146 (all exact positions) + 15 + 10 + 5 = 176 pts
 */
export function scoreFullBracket(
  picks: BracketPick[],
  totalCastaways: number,
): number {
  let total = 0;
  let endgameExactCount = 0;
  const endgameStart = totalCastaways - 4; // positions 14-18 for 18-castaway season

  for (const pick of picks) {
    if (pick.actual_position === null) continue;

    const pickPoints = scoreBracketPick(
      pick.predicted_position,
      pick.actual_position,
      totalCastaways,
    );
    total += pickPoints;

    // Track endgame accuracy for perfect endgame bonus
    if (
      pick.actual_position >= endgameStart &&
      pick.predicted_position === pick.actual_position
    ) {
      endgameExactCount++;
    }

    // Sole Survivor exact bonus
    if (
      pick.predicted_position === totalCastaways &&
      pick.actual_position === totalCastaways
    ) {
      total += BRACKET_BONUSES.SOLE_SURVIVOR_EXACT;
    }

    // First boot exact bonus
    if (
      pick.predicted_position === 1 &&
      pick.actual_position === 1
    ) {
      total += BRACKET_BONUSES.FIRST_BOOT_EXACT;
    }
  }

  // Perfect endgame bonus: all 5 endgame positions (14-18) predicted exactly
  if (endgameExactCount === 5) {
    total += BRACKET_BONUSES.PERFECT_ENDGAME;
  }

  return total;
}

/**
 * Calculate the maximum possible score for a season.
 * Useful for displaying percentage-based progress.
 */
export function getMaxBracketScore(totalCastaways: number = 18): number {
  let positionTotal = 0;
  for (let i = 1; i <= totalCastaways; i++) {
    positionTotal += getPositionBaseValue(i, totalCastaways);
  }

  return (
    positionTotal +
    BRACKET_BONUSES.SOLE_SURVIVOR_EXACT +
    BRACKET_BONUSES.PERFECT_ENDGAME +
    BRACKET_BONUSES.FIRST_BOOT_EXACT
  );
}

/**
 * Score a weekly pick'em entry for one episode.
 */
export function scoreWeeklyPick(
  pick: WeeklyPick,
  actualEliminatedId: number | null,
  actualImmunityWinnerId: number | null,
): number {
  let points = 0;

  if (
    actualEliminatedId !== null &&
    pick.picked_eliminated_id === actualEliminatedId
  ) {
    points += WEEKLY_SCORING.CORRECT_VOTE_OUT;
  }

  if (
    actualImmunityWinnerId !== null &&
    pick.picked_immunity_id === actualImmunityWinnerId
  ) {
    points += WEEKLY_SCORING.CORRECT_IMMUNITY;
  }

  return points;
}

/**
 * Check if a survivor pool pick survives the episode.
 * Returns true if the picked castaway was NOT eliminated.
 */
export function checkSurvivorPoolPick(
  pickedCastawayId: number,
  eliminatedCastawayIds: number[],
): boolean {
  return !eliminatedCastawayIds.includes(pickedCastawayId);
}

/**
 * Get the list of castaways a user has already picked in a survivor pool.
 * Used to enforce the "no reuse" rule.
 */
export function getUsedCastaways(
  picks: { picked_castaway_id: number }[],
): number[] {
  return picks.map((p) => p.picked_castaway_id);
}

/**
 * Calculate draft scoring event points.
 */
export function getDraftEventPoints(
  event: keyof typeof DRAFT_SCORING,
): number {
  return DRAFT_SCORING[event];
}

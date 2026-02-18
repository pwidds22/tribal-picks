import {
  BRACKET_SCORING,
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
 * Score a bracket pick based on predicted vs actual elimination position.
 */
export function scoreBracketPick(
  predictedPosition: number,
  actualPosition: number
): number {
  const diff = Math.abs(predictedPosition - actualPosition);

  if (diff === 0) return BRACKET_SCORING.EXACT;
  if (diff === 1) return BRACKET_SCORING.OFF_BY_1;
  if (diff === 2) return BRACKET_SCORING.OFF_BY_2;
  return BRACKET_SCORING.OFF_BY_3_PLUS;
}

/**
 * Score a full bracket (all picks for one user in one league).
 * Includes bonus for correctly predicting the winner.
 */
export function scoreFullBracket(
  picks: BracketPick[],
  totalCastaways: number
): number {
  let total = 0;

  for (const pick of picks) {
    if (pick.actual_position === null) continue;
    total += scoreBracketPick(pick.predicted_position, pick.actual_position);

    // Bonus for correctly predicting the winner (last position = winner)
    if (
      pick.predicted_position === totalCastaways &&
      pick.actual_position === totalCastaways
    ) {
      total += BRACKET_SCORING.CORRECT_WINNER_BONUS;
    }
  }

  return total;
}

/**
 * Score a weekly pick'em entry for one episode.
 */
export function scoreWeeklyPick(
  pick: WeeklyPick,
  actualEliminatedId: number | null,
  actualImmunityWinnerId: number | null
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
  eliminatedCastawayIds: number[]
): boolean {
  return !eliminatedCastawayIds.includes(pickedCastawayId);
}

/**
 * Get the list of castaways a user has already picked in a survivor pool.
 * Used to enforce the "no reuse" rule.
 */
export function getUsedCastaways(
  picks: { picked_castaway_id: number }[]
): number[] {
  return picks.map((p) => p.picked_castaway_id);
}

/**
 * Calculate draft scoring event points.
 */
export function getDraftEventPoints(
  event: keyof typeof DRAFT_SCORING
): number {
  return DRAFT_SCORING[event];
}

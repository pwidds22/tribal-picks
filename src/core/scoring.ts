import {
  BRACKET_ESCALATING,
  DRAFT_SCORING,
  WEEKLY_SCORING,
  type BracketPick,
  type WeeklyPick,
} from './types';

// ============================================
// Pure scoring functions — no side effects
//
// WARNING: Bracket scoring logic is duplicated in the Supabase Edge Function
// `sync-results/index.ts` for server-side scoring. Any changes here MUST be
// mirrored in the Edge Function. There are no automated tests to verify
// client and server scoring are in sync — verify manually after changes.
//
// Edge cases handled by the scoring system:
// - Double elimination: two tribals in one episode both counted (totalElims incremented twice)
// - Medevac/Quit: treated as an elimination (increments elimination_order)
// - No tribal (recap/reunion): no scoring for that episode
// - Idol play: scored based on FINAL result (whoever actually went home)
// - Fire-making (F4): loser is eliminated normally
// ============================================

// ---------- Bracket: Escalating Survival ----------
// After each episode: episode_score = episode_number × correct_still_in_count
// Winner bonus: +50 if Sole Survivor pick is correct

/**
 * Score one episode for one user's bracket.
 *
 * A castaway is in your "still in" set if predicted_position > totalElims.
 * Episode score = episodeNumber × |your_still_in ∩ actual_still_in|.
 *
 * For flex-start leagues: predicted_position is already stored with offset
 * (e.g., mid-season league starting after 8 elims stores positions 9-24),
 * so no extra offset logic is needed here.
 */
export function scoreBracketEpisode(
  picks: BracketPick[],
  episodeNumber: number,
  totalElims: number,
  actualStillInIds: Set<number>,
): number {
  let correct = 0;
  for (const pick of picks) {
    if (pick.predicted_position > totalElims && actualStillInIds.has(pick.castaway_id)) {
      correct++;
    }
  }
  return episodeNumber * correct;
}

/**
 * Calculate the winner bonus for one user.
 * Returns WINNER_BONUS (50) if the user's highest-position pick
 * matches the actual Sole Survivor, else 0.
 *
 * @param winnerPosition  The predicted_position value that represents
 *                        the Sole Survivor slot. For full-season leagues
 *                        this equals total castaways (e.g., 24). For
 *                        flex-start leagues it's the offset max position
 *                        (e.g., 24 even if only 16 remain in the bracket).
 */
export function getWinnerBonus(
  picks: BracketPick[],
  actualWinnerId: number,
  winnerPosition: number,
): number {
  const winnerPick = picks.find(
    (p) => p.predicted_position === winnerPosition,
  );
  if (winnerPick && winnerPick.castaway_id === actualWinnerId) {
    return BRACKET_ESCALATING.WINNER_BONUS;
  }
  return 0;
}

/**
 * Compute the theoretical maximum score for a perfect bracket.
 *
 * Perfect score = sum(episodeNumber × remainingCount) + WINNER_BONUS
 *
 * @param episodeRemainingCounts  Array where [i] = castaways remaining after episode i+1
 *                                (0-indexed: [0] = remaining after ep 1, etc.)
 */
export function getMaxEscalatingScore(
  episodeRemainingCounts: number[],
): number {
  let max = BRACKET_ESCALATING.WINNER_BONUS;
  for (let i = 0; i < episodeRemainingCounts.length; i++) {
    max += (i + 1) * episodeRemainingCounts[i];
  }
  return max;
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

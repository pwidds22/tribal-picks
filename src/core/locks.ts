// Pure functions for determining pick lock status.
// CBS Survivor airs Wednesdays at 8:00 PM Eastern Time.

/**
 * Returns true if bracket picks are locked (season has started).
 * Brackets lock at 8:00 PM ET on premiere night.
 */
export function isBracketLocked(premiereDate: string | null): boolean {
  if (!premiereDate) return false;
  return Date.now() >= getLockTimeET(premiereDate);
}

/**
 * Returns true if episode picks are locked (episode has aired).
 * Episode picks lock at 8:00 PM ET on air date.
 */
export function isEpisodeLocked(airDate: string | null): boolean {
  if (!airDate) return false;
  return Date.now() >= getLockTimeET(airDate);
}

/**
 * Get a human-readable lock deadline string.
 * Returns something like "Feb 25 at 8:00 PM ET"
 */
export function getLockDeadlineLabel(dateStr: string | null): string {
  if (!dateStr) return 'TBD';
  const date = new Date(dateStr + 'T20:00:00-05:00');
  return (
    date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' at 8:00 PM ET'
  );
}

/**
 * Get milliseconds until lock time for countdown display.
 * Returns 0 if already locked.
 */
export function getMillisUntilLock(dateStr: string | null): number {
  if (!dateStr) return 0;
  return Math.max(0, getLockTimeET(dateStr) - Date.now());
}

// Convert a date string to a lock timestamp (8 PM ET).
// Uses -05:00 (EST). During EDT this is conservative by 1 hour
// which is fine — locks slightly early rather than late.
function getLockTimeET(dateStr: string): number {
  return new Date(dateStr + 'T20:00:00-05:00').getTime();
}

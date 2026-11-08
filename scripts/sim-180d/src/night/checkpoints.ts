/** The nights the run snapshots for the screen census and the walks: day 1, a week, a month, New Year's Eve, 90, 180. */
import type { Night } from '../calendar/calendar.ts';

const FIXED = [1, 7, 30, 90, 180] as const;
const NEW_YEARS_EVE = '2026-12-31';

export function checkpointNights(nights: readonly Night[]): number[] {
  const eve = nights.find((night) => night.date === NEW_YEARS_EVE)?.n;
  return [...FIXED, ...(eve === undefined ? [] : [eve])].sort((a, b) => a - b);
}

/** The scope of the night's checks: the heavier month checks every 30 nights. */
export function scopeOf(n: number): 'night' | 'month' {
  return n % 30 === 0 ? 'month' : 'night';
}

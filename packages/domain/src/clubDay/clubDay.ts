// The club's day runs 06:00 to 06:00 IST. IST is UTC+05:30 all year, so 06:00 IST is 00:30 UTC.
const CLUB_CLOCK_OFFSET_MS = -30 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The club's day a moment falls in, as `2026-11-15`: 02:00 IST on the 16th is still the 15th's night. */
export function clubDay(at: Date): string {
  return new Date(at.getTime() + CLUB_CLOCK_OFFSET_MS).toISOString().slice(0, 10);
}

/** The club's days from `first` to `last` (`2026-11-15`), as the moments they begin and end: 06:00 IST on the first to 06:00 IST after the last. */
export function clubDaysPeriod(first: string, last: string): { start: Date; end: Date } {
  return { start: new Date(`${first}T06:00:00+05:30`), end: new Date(new Date(`${last}T06:00:00+05:30`).getTime() + DAY_MS) };
}

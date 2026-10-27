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

/** The first days of the last `count` club months, the one a moment falls in first: `2026-10-01`, `2026-09-01`, and so on. */
export function recentClubMonths(at: Date, count: number): string[] {
  const [year = 0, month = 1] = clubDay(at).split('-').map(Number);
  return Array.from({ length: count }, (_, back) => new Date(Date.UTC(year, month - 1 - back, 1)).toISOString().slice(0, 10));
}

/** A month's last day, from its first: `2026-02-01` gives `2026-02-28`. */
export function lastDayOfMonth(first: string): string {
  const [year = 0, month = 1] = first.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

/** The day `count` days after a club day (`2026-11-15`), or before it for a negative count. */
export function dayAfter(day: string, count: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + count * DAY_MS).toISOString().slice(0, 10);
}

/** The club week a club day falls in, Monday to Sunday, by its Monday: `2026-11-18`, a Wednesday, is in `2026-11-16`'s. */
export function weekOf(day: string): string {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return dayAfter(day, -((weekday + 6) % 7));
}

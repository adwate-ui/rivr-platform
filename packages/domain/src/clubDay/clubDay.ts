// The club's day runs 06:00 to 06:00 IST. IST is UTC+05:30 all year, so 06:00 IST is 00:30 UTC.
const CLUB_CLOCK_OFFSET_MS = -30 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The club's day a moment falls in, as `2026-11-15`: 02:00 IST on the 16th is still the 15th's night. */
export function clubDay(at: Date): string {
  return new Date(at.getTime() + CLUB_CLOCK_OFFSET_MS).toISOString().slice(0, 10);
}

/** The moment a time (`23:10`, India's clock) falls on a club day: 06:00 to 23:59 that date, 00:00 to 05:59 the next morning. */
export function clubDayMoment(day: string, time: string): Date {
  const at = new Date(`${day}T${time}:00+05:30`);
  return time < '06:00' ? new Date(at.getTime() + DAY_MS) : at;
}

// India's clock is UTC+05:30 all year.
const IST_OFFSET_MS = 330 * 60 * 1000;
const CLOCK_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const CLUB_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/**
 * A visit's check-in and check-out on a club night (`2026-11-20`, `20:00`, `02:30`), as a visit added by hand or from a file
 * names them (the owner, 25 Nov; #1134): each as clubDayMoment places it, so a time before 06:00 is the next morning.
 * Null for a date or a time that is not one, or a check-out not after the check-in.
 */
export function clubNightSpan(day: string, checkIn: string, checkOut: string): { openedAt: Date; closedAt: Date } | null {
  if (!CLUB_DATE.test(day) || !CLOCK_TIME.test(checkIn) || !CLOCK_TIME.test(checkOut)) return null;
  const openedAt = clubDayMoment(day, checkIn);
  const closedAt = clubDayMoment(day, checkOut);
  if (Number.isNaN(openedAt.getTime()) || clubDay(openedAt) !== day || closedAt <= openedAt) return null;
  return { openedAt, closedAt };
}

/**
 * The moment a time on India's clock (`23:40`, as a time field gives it) names nearest `at`, within twelve hours either side
 * (ahead on a tie): 01:30 picked at 23:50 is tonight's, two hours on; 22:00 picked at 22:44 is the one just gone, never
 * tomorrow's, so a slip of the picker cannot ask for a day. Null for anything but a time.
 */
export function nearestClockMoment(time: string, at: Date): Date | null {
  if (!CLOCK_TIME.test(time)) return null;
  const today = new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
  const moment = new Date(`${today}T${time}:00+05:30`).getTime();
  const nearest = [moment - DAY_MS, moment, moment + DAY_MS].find((candidate) => Math.abs(candidate - at.getTime()) < DAY_MS / 2
    || candidate - at.getTime() === DAY_MS / 2);
  return new Date(nearest ?? moment);
}

/** The first mark of `stepMinutes` on India's clock strictly after a moment, as a time field takes it: 23:12 by 5s gives `23:15`. */
export function clockTimeAfter(at: Date, stepMinutes: number): string {
  const step = stepMinutes * 60 * 1000;
  const mark = Math.floor(at.getTime() / step) * step + step;
  return new Date(mark + IST_OFFSET_MS).toISOString().slice(11, 16);
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

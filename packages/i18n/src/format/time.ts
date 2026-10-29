// Times are stored in UTC and always shown in India time.
const TIME_ZONE = 'Asia/Kolkata';

const CLOCK = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const DATE = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, day: 'numeric', month: 'short', year: 'numeric' });

const WEEKDAY = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, weekday: 'long' });

const DAY = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, weekday: 'short', day: 'numeric', month: 'short' });

const DAY_MONTH = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, day: 'numeric', month: 'short' });

/** The 24-hour IST clock time: `02:40`. */
export function formatTime(at: Date): string {
  return CLOCK.format(at);
}

/** The IST calendar date: `15 Nov 2026`. */
export function formatDate(at: Date): string {
  return DATE.format(at);
}

/** The IST day and month, for a date within the year: `13 Feb`, as in a movement or "Issued 2 Feb · due 4 Mar". */
export function formatDayMonth(at: Date): string {
  return DAY_MONTH.format(at);
}

/** The IST day and time within the coming weeks: `Wed 17 Feb, 00:10`, as in "Until Wed 17 Feb, 00:10". */
export function formatDayTime(at: Date): string {
  return `${DAY.format(at)}, ${formatTime(at)}`;
}

/** A time still to run, in whole minutes rounded up: `1 h 12 min`, `2 h`, `45 min`, `1 min`. */
export function formatDuration(seconds: number): string {
  const minutes = Math.ceil(Math.max(0, seconds) / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** A countdown as a clock shows it, in whole seconds rounded down: `11:29`, `05:00`, `1:15:00` from an hour up. */
export function formatCountdown(seconds: number): string {
  const whole = Math.floor(Math.max(0, seconds));
  const two = (value: number) => String(value).padStart(2, '0');
  const hours = Math.floor(whole / 3600);
  const clock = `${two(Math.floor((whole % 3600) / 60))}:${two(whole % 60)}`;
  return hours === 0 ? clock : `${hours}:${clock}`;
}

/** The IST day of the week: `Sunday`, as in "expires Sunday". */
export function formatWeekday(at: Date): string {
  return WEEKDAY.format(at);
}

const ISO_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

/** The IST calendar date as `2026-11-15`, so a moment can be found on a month's calendar (#617). */
export function formatIsoDay(at: Date): string {
  return ISO_DAY.format(at);
}

// A calendar month is a name, not a moment, so it is read in UTC where its first day starts at midnight.
const MONTH = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' });

/** A calendar month given as `2026-11` or its first day `2026-11-01`: `November 2026`, as a League month is named. */
export function formatMonth(month: string): string {
  return MONTH.format(new Date(`${month.slice(0, 7)}-01T00:00:00Z`));
}

/**
 * A quarter from its first day (`2026-10-01`), as `Oct–Dec 2026`: the Indian financial year's quarters
 * are the calendar's. Its formatter is made when asked for, so the player's first load, which never
 * names a quarter, does not carry it.
 */
export function formatQuarter(firstDay: string): string {
  const month = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'short' });
  const start = new Date(`${firstDay}T00:00:00Z`);
  const last = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 2, 1));
  return `${month.format(start)}–${month.format(last)} ${start.getUTCFullYear()}`;
}

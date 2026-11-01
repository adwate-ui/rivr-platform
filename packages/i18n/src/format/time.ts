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

// Three letters for every month: en-GB gives September as "Sept", alone among them, so the names are our own (F5-11).
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const MONTH_NUMBER = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, month: 'numeric' });

/** A date as `format` writes it in IST, its month in three letters. */
function withMonth(format: Intl.DateTimeFormat, at: Date): string {
  const month = MONTHS[Number(MONTH_NUMBER.format(at)) - 1] ?? '';
  return format.formatToParts(at).map((part) => (part.type === 'month' ? month : part.value)).join('');
}

/** The 24-hour IST clock time: `02:40`. */
export function formatTime(at: Date): string {
  return CLOCK.format(at);
}

/** The IST calendar date: `15 Nov 2026`. */
export function formatDate(at: Date): string {
  return withMonth(DATE, at);
}

/** The IST day and month, for a date within the year: `13 Feb`, as in a movement or "Issued 2 Feb · due 4 Mar". */
export function formatDayMonth(at: Date): string {
  return withMonth(DAY_MONTH, at);
}

/** The IST day and time within the coming weeks: `Wed 17 Feb, 00:10`, as in "Until Wed 17 Feb, 00:10". */
export function formatDayTime(at: Date): string {
  return `${withMonth(DAY, at)}, ${formatTime(at)}`;
}

/** The IST date and time of a moment that may be months away, with its year: `1 Nov 2027, 19:51`, as a break's end. */
export function formatDateTime(at: Date): string {
  return `${formatDate(at)}, ${formatTime(at)}`;
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
 * are the calendar's; its months are three letters, `Jul–Sep` (F5-11).
 */
export function formatQuarter(firstDay: string): string {
  const start = new Date(`${firstDay}T00:00:00Z`);
  const lastMonth = (start.getUTCMonth() + 2) % 12;
  return `${MONTHS[start.getUTCMonth()] ?? ''}–${MONTHS[lastMonth] ?? ''} ${start.getUTCFullYear()}`;
}

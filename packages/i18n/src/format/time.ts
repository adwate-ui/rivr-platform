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

/** The 24-hour IST clock time: `02:40`. */
export function formatTime(at: Date): string {
  return CLOCK.format(at);
}

/** The IST calendar date: `15 Nov 2026`. */
export function formatDate(at: Date): string {
  return DATE.format(at);
}

/** The IST day and time within the coming weeks: `Wed 17 Feb, 00:10`, as in "Until Wed 17 Feb, 00:10". */
export function formatDayTime(at: Date): string {
  return `${DAY.format(at)}, ${formatTime(at)}`;
}

/** The IST day of the week: `Sunday`, as in "expires Sunday". */
export function formatWeekday(at: Date): string {
  return WEEKDAY.format(at);
}

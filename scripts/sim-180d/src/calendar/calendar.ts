/** The 180 club nights, 15 Nov 2026 to 13 May 2027: how busy each is, and which scripted events fall on it. */

export const NIGHTS = 180;
const FIRST_NIGHT = Date.UTC(2026, 10, 15);
const DAY = 24 * 60 * 60 * 1000;

export interface Night {
  /** 1 to 180. */
  n: number;
  /** The calendar date the night starts on, in IST. */
  date: string;
  /** 0 is Sunday. */
  weekday: number;
  /** Players expected at the tables. */
  expected: number;
  peak: boolean;
  /** Scripted events: see EVENTS. */
  events: string[];
}

// Holi is 22 Mar 2027 (Holika Dahan the evening before): hindutone.com/festivals/holi-2027, checked 8 Nov 2026.
const PEAKS: Readonly<Record<string, number>> = {
  '2026-12-24': 1.3,
  '2026-12-25': 1.3,
  // A Thursday, so it needs more than a weekend's lift to be the busiest night of the run.
  '2026-12-31': 2.2,
  '2027-03-22': 1.3,
};

/** Each scripted event, on the night it happens. */
const EVENTS: Readonly<Record<string, string>> = {
  '2026-11-15': 'launch',
  '2026-11-17': 'welcome_promotion',
  '2026-11-24': 'notice_posted',
  '2026-12-04': 'staff_removed',
  '2026-12-14': 'self_exclusion',
  '2026-12-24': 'whatsapp_outage',
  '2027-01-03': 'tier_change',
  '2027-01-08': 'reward_stock_runs_out',
  '2027-01-28': 'venue_freeze',
  '2027-02-12': 'practice_reset',
  '2027-02-22': 'erasure',
  '2027-03-04': 'staff_rejoins',
  '2027-03-14': 'promotion_ends',
  '2027-04-01': 'year_start',
  '2027-04-20': 'kyc_reopened',
};

const isoDate = (n: number): string => new Date(FIRST_NIGHT + (n - 1) * DAY).toISOString().slice(0, 10);

/** A weeknight grows from 40 players on night 1 to 60 on night 180, as membership grows. */
function weeknight(n: number): number {
  return 40 + (20 * (n - 1)) / (NIGHTS - 1);
}

function expectedOn(n: number, date: string, weekday: number): number {
  const weekend = weekday === 5 || weekday === 6 ? 1.5 : 1;
  const raw = Math.round(weeknight(n) * weekend * (PEAKS[date] ?? 1));
  return date === '2026-12-31' ? raw : Math.min(90, raw);
}

export function buildCalendar(): Night[] {
  return Array.from({ length: NIGHTS }, (_, index) => {
    const n = index + 1;
    const date = isoDate(n);
    const weekday = new Date(FIRST_NIGHT + index * DAY).getUTCDay();
    const event = EVENTS[date];
    return { n, date, weekday, expected: expectedOn(n, date, weekday), peak: date in PEAKS, events: event === undefined ? [] : [event] };
  });
}

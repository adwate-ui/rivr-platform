import type { Schedule } from '@rivr/contracts/promotionModel';
import { clubDay, clubDayMoment, dayAfter } from '../clubDay/clubDay.ts';

const MINUTE_MS = 60_000;
const DAY_MINUTES = 1_440;

/** A span of time played: from when the member sat down to when they left. */
export interface Span {
  readonly from: Date;
  readonly to: Date;
}

function minutesOf(time: string): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/** How long each opening lasts, in minutes: from `from` to the next `to`, so 20:00 to 02:00 is 360; the same time at both ends is a whole day. */
export function openingMinutes(schedule: Pick<Schedule, 'from' | 'to'>): number {
  return (minutesOf(schedule.to) - minutesOf(schedule.from) + DAY_MINUTES) % DAY_MINUTES || DAY_MINUTES;
}

/** A club day's weekday (`2026-11-17`), ISO: 1 Monday to 7 Sunday. */
function weekdayOf(day: string): number {
  return new Date(`${day}T00:00:00Z`).getUTCDay() || 7;
}

function opensOn(schedule: Schedule, day: string): boolean {
  return schedule.days.includes(weekdayOf(day)) && day >= schedule.startsOn && (schedule.endsOn === undefined || day <= schedule.endsOn);
}

/** The opening that begins on a club day, from its start up to its end in epoch milliseconds; null when none begins that day. */
function openingOn(schedule: Schedule, day: string): readonly [number, number] | null {
  if (!opensOn(schedule, day)) return null;
  const start = clubDayMoment(day, schedule.from).getTime();
  return [start, start + openingMinutes(schedule) * MINUTE_MS];
}

function overlapMs(opening: readonly [number, number] | null, from: number, to: number): number {
  return opening === null ? 0 : Math.max(0, Math.min(to, opening[1]) - Math.max(from, opening[0]));
}

const isWithin = (opening: readonly [number, number] | null, moment: number) => opening !== null && moment >= opening[0] && moment < opening[1];

/**
 * Whether a moment is in one of the schedule's openings (decision 0438): the one that began this club day, or last
 * night's still running past midnight or the 06:00 turnover. An opening is on a listed club day from the start day to
 * the end day; it begins at `from` that club day (02:00 on a Tuesday is the small hours after Tuesday evening) and runs
 * up to, not including, its end. The database's private.is_in_schedule is proved equal on promotionSchedule.json.
 */
export function isInSchedule(schedule: Schedule, at: Date): boolean {
  const today = clubDay(at);
  const moment = at.getTime();
  return isWithin(openingOn(schedule, dayAfter(today, -1)), moment) || isWithin(openingOn(schedule, today), moment);
}

/**
 * The whole seconds of a span inside the schedule's openings: on each club day whose opening could touch it, the part
 * of the span inside that opening. Time-played rewards weigh only these seconds. The database's
 * private.seconds_in_schedule is proved equal on promotionSchedule.json.
 */
export function secondsInSchedule(span: Span, schedule: Schedule): number {
  const from = span.from.getTime();
  const to = span.to.getTime();
  let total = 0;
  for (let day = dayAfter(clubDay(span.from), -1); day <= clubDay(span.to); day = dayAfter(day, 1)) {
    total += overlapMs(openingOn(schedule, day), from, to);
  }
  return Math.floor(total / 1000);
}

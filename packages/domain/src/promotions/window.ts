import type { PromotionConditions } from '@rivr/contracts/promotions';
import { tablePlayedSeconds } from '../points/points.ts';
import { CLUB_CLOCK_OFFSET_MS, clubMinute, MINUTES_IN_DAY } from './promotions.ts';

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

/** A span of seated time at one table: from when the member sat down there to when they left it. */
export interface Stint {
  readonly from: Date;
  readonly to: Date;
}

/** A member's time at one table in one seat session: the stints there, the session's seconds and the seconds played in it. */
export interface TableTime {
  readonly stints: readonly Stint[];
  readonly sessionSeconds: bigint;
  readonly playedSeconds: bigint;
}

/** The window as minutes into the club's day: from its start to, not including, its end; no times is the whole day. */
function windowMinutes(conditions: PromotionConditions): readonly [number, number] {
  if (conditions.from === undefined || conditions.until === undefined) return [0, MINUTES_IN_DAY];
  return [clubMinute(conditions.from), clubMinute(conditions.until) || MINUTES_IN_DAY];
}

/**
 * The whole seconds of a stint inside a promotion's window (#457; the owner's answer on question #445):
 * on each club day the stint touches that the window's days allow, the part of it between the window's
 * start and end. Days and times are the club's, 06:00 to 06:00 IST, as promotionApplies reads them. The
 * database's private.seconds_in_window is proved equal on packages/testing/golden/promotionWindow.json.
 */
export function secondsInWindow(stint: Stint, conditions: PromotionConditions): bigint {
  const start = stint.from.getTime() + CLUB_CLOCK_OFFSET_MS;
  const end = stint.to.getTime() + CLUB_CLOCK_OFFSET_MS;
  const [low, high] = windowMinutes(conditions);
  let total = 0;
  for (let day = Math.floor(start / DAY_MS) * DAY_MS; day < end; day += DAY_MS) {
    const weekday = new Date(day).getUTCDay() || 7;
    if (conditions.days !== undefined && !conditions.days.includes(weekday)) continue;
    total += Math.max(0, Math.min(end, day + high * MINUTE_MS) - Math.max(start, day + low * MINUTE_MS));
  }
  return BigInt(Math.floor(total / 1000));
}

/**
 * The seconds played at one table of a session inside a window: its stints' seconds inside the window,
 * less a share of the time away, as tablePlayedSeconds shares it. No record says when time away was
 * taken, so it is spread evenly. Its points are pointsForTime at the table's rate. The database does the
 * same in private.visit_window_time.
 */
export function playedSecondsInWindow(time: TableTime, conditions: PromotionConditions): bigint {
  const inWindow = time.stints.reduce((seconds, stint) => seconds + secondsInWindow(stint, conditions), 0n);
  return tablePlayedSeconds(inWindow, time.sessionSeconds, time.playedSeconds);
}

import { err, ok, type Result } from '@rivr/contracts/result';

/**
 * The lengths of more call time offered while the club has typed none, in minutes: 30 min, 1 hour, 2 hours (decision
 * 0320). The club types its own in Settings (call_time.add_choices, redesign RD-19); the member asks for one from the seat
 * and the floor approves it, or the floor adds one.
 */
export const ADD_TIME_CHOICES: readonly number[] = [30, 60, 120];

/** A call time is at most a day, in all. */
export const CALL_TIME_CAP_MINUTES = 24 * 60;

/** Why more call time is refused: not a length (whole minutes, 1 to a day), a seat with no call time, or past a day in all. */
export type ExtensionRefusal = 'not_a_choice' | 'no_call_time' | 'over_a_day';

/** Whether the minutes are a length of more call time: whole minutes, from 1 to a day. Which the club offers is its setting. */
export function isAddTimeLength(minutes: number): boolean {
  return Number.isInteger(minutes) && minutes >= 1 && minutes <= CALL_TIME_CAP_MINUTES;
}

/**
 * The seat's call time once more is added (packages/testing/golden/callTimeExtension.json; the database's
 * private.extended_call_time is proved equal on it): the length asked for, added whole to the later of the call time and
 * the whole minutes played, so time added after the call time is met runs from now (decision 0305); only to a seat with
 * a call time, up to a day in all; anything else refused, never cut down.
 */
export function extendedCallTime(currentMinutes: number, playedMinutes: number, addMinutes: number): Result<number, ExtensionRefusal> {
  if (!isAddTimeLength(addMinutes)) return err('not_a_choice');
  // A call time is whole minutes, as the database keeps it: anything else is none to add to.
  if (!Number.isInteger(currentMinutes) || currentMinutes <= 0) return err('no_call_time');
  // Whole minutes played, floored as the database counts them; none, or not a number, counts as nought.
  const played = Number.isFinite(playedMinutes) && playedMinutes > 0 ? Math.floor(playedMinutes) : 0;
  const total = Math.max(currentMinutes, played) + addMinutes;
  return total > CALL_TIME_CAP_MINUTES ? err('over_a_day') : ok(total);
}

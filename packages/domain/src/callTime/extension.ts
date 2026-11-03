import { err, ok, type Result } from '@rivr/contracts/result';

/**
 * Every length the club may offer for more call time, in minutes (decision 0305): the club ticks which in Settings
 * (call_time.add_choices); the member asks for one from the seat and the floor approves it, or the floor adds one.
 */
export const ADD_TIME_PRESETS = [15, 30, 45, 60, 90, 120, 180, 240] as const;

/** One of the lengths the club may offer. */
export type AddTimeMinutes = (typeof ADD_TIME_PRESETS)[number];

/** The lengths offered while the club has ticked none: 30 min, 1 hour, 2 hours (decision 0320). */
export const ADD_TIME_CHOICES: readonly AddTimeMinutes[] = [30, 60, 120];

/** A call time is at most a day, in all. */
export const CALL_TIME_CAP_MINUTES = 24 * 60;

/** Why more call time is refused: not a length the club may offer, a seat with no call time, or past a day in all. */
export type ExtensionRefusal = 'not_a_choice' | 'no_call_time' | 'over_a_day';

/** Whether the minutes are one of the lengths the club may offer. */
export function isAddTimeChoice(minutes: number): minutes is AddTimeMinutes {
  return ADD_TIME_PRESETS.some((choice) => choice === minutes);
}

/**
 * The seat's call time once more is added (packages/testing/golden/callTimeExtension.json; the database's
 * private.extended_call_time is proved equal on it): the length asked for, added whole to the later of the call time and
 * the whole minutes played, so time added after the call time is met runs from now (decision 0305); only to a seat with
 * a call time, up to a day in all; anything else refused, never cut down.
 */
export function extendedCallTime(currentMinutes: number, playedMinutes: number, addMinutes: number): Result<number, ExtensionRefusal> {
  if (!isAddTimeChoice(addMinutes)) return err('not_a_choice');
  // A call time is whole minutes, as the database keeps it: anything else is none to add to.
  if (!Number.isInteger(currentMinutes) || currentMinutes <= 0) return err('no_call_time');
  // Whole minutes played, floored as the database counts them; none, or not a number, counts as nought.
  const played = Number.isFinite(playedMinutes) && playedMinutes > 0 ? Math.floor(playedMinutes) : 0;
  const total = Math.max(currentMinutes, played) + addMinutes;
  return total > CALL_TIME_CAP_MINUTES ? err('over_a_day') : ok(total);
}

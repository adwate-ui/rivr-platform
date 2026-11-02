import { err, ok, type Result } from '@rivr/contracts/result';

/** What a member may ask to add to their call time from the seat (decision 0320), in minutes: 30 min, 1 hour, 2 hours. */
export const ADD_TIME_CHOICES = [30, 60, 120] as const;

/** One of the lengths a member may ask for. */
export type AddTimeMinutes = (typeof ADD_TIME_CHOICES)[number];

/** A call time is at most a day, in all. */
export const CALL_TIME_CAP_MINUTES = 24 * 60;

/** Why more call time is refused: not a length offered, a seat with no call time, or past a day in all. */
export type ExtensionRefusal = 'not_a_choice' | 'no_call_time' | 'over_a_day';

/** Whether the minutes are one of the lengths offered. */
export function isAddTimeChoice(minutes: number): minutes is AddTimeMinutes {
  return ADD_TIME_CHOICES.some((choice) => choice === minutes);
}

/**
 * The seat's call time once the floor approves more (packages/testing/golden/callTimeExtension.json; the database's
 * private.extended_call_time is proved equal on it): the minutes asked for added whole, to a call time the seat has, up to
 * a day in all; anything else refused, never cut down.
 */
export function extendedCallTime(currentMinutes: number, addMinutes: number): Result<number, ExtensionRefusal> {
  if (!isAddTimeChoice(addMinutes)) return err('not_a_choice');
  if (currentMinutes <= 0) return err('no_call_time');
  const total = currentMinutes + addMinutes;
  return total > CALL_TIME_CAP_MINUTES ? err('over_a_day') : ok(total);
}

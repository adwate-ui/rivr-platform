import { err, ok, type Result } from '@rivr/contracts/result';
import { CALL_TIME_CAP_MINUTES, extendedCallTime, isAddTimeLength } from './extension.ts';

/** A seat's call time as the choice rule reads it. */
export interface SeatCallTime {
  /** The call time now, in whole minutes; nought for a seat with none. */
  readonly currentMinutes: number;
  /** Minutes played, net of time away, as the database counts them. */
  readonly playedMinutes: number;
  /** The call time the seat started with, before any was set or added. */
  readonly initialMinutes: number;
  /** Whether a call time has been set, by the member or by the floor's Add call time. */
  readonly isSet: boolean;
}

/**
 * Why a length is refused: not a length (whole minutes, 1 to a day), a seat with no call time, ending no later than the
 * call time the seat started with (or before the one owed now), or past a day.
 */
export type CallTimeChoiceRefusal = 'not_a_choice' | 'no_call_time' | 'not_after_call_time' | 'over_a_day';

/** Whole minutes played, floored as the database counts them; none, or not a number, counts as nought. */
function wholeMinutesPlayed(played: number): number {
  return Number.isFinite(played) && played > 0 ? Math.floor(played) : 0;
}

/**
 * The seat's call time once a length is chosen for it, by the member from the seat or by the floor's Add call time (the
 * owner, 18 Nov; #1076; packages/testing/golden/callTimeChoice.json, which private.call_time_choice_end is proved equal
 * on). Until a call time is set, the length counts from now (the whole minutes played plus the length) and is open only
 * when it ends strictly after the call time the seat started with, never before the one owed now. Once set, the length
 * extends it, as more call time always has (extendedCallTime). Only a seat with a call time; a day at most in all.
 */
export function callTimeChoiceEnd(seat: SeatCallTime, lengthMinutes: number): Result<number, CallTimeChoiceRefusal> {
  if (seat.isSet) return extendedCallTime(seat.currentMinutes, seat.playedMinutes, lengthMinutes);
  if (!isAddTimeLength(lengthMinutes)) return err('not_a_choice');
  if (!Number.isInteger(seat.currentMinutes) || seat.currentMinutes <= 0) return err('no_call_time');
  const total = wholeMinutesPlayed(seat.playedMinutes) + lengthMinutes;
  if (total > CALL_TIME_CAP_MINUTES) return err('over_a_day');
  return total <= seat.initialMinutes || total < seat.currentMinutes ? err('not_after_call_time') : ok(total);
}

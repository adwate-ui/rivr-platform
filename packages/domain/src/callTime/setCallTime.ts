import { err, ok, type Result } from '@rivr/contracts/result';
import { CALL_TIME_CAP_MINUTES, isAddTimeLength } from './extension.ts';

/** Why a call time the member sets is refused: not a length, a seat with no call time, ending before the call time they owe, or past a day. */
export type SetCallTimeRefusal = 'not_a_choice' | 'no_call_time' | 'before_call_time' | 'over_a_day';

/** Whole minutes played, floored as the database counts them; none, or not a number, counts as nought. */
function wholeMinutesPlayed(played: number): number {
  return Number.isFinite(played) && played > 0 ? Math.floor(played) : 0;
}

/**
 * The seat's call time once the member sets one from the seat (the owner, 17 Nov;
 * packages/testing/golden/callTimeSet.json, which private.set_call_time is proved equal on): the length chosen, counted
 * from now, so the whole minutes played plus the length. They owe it as well as the call time they had: one that would
 * end before it is refused, never cut down. A call time is at most a day, 1,440 minutes, in all. Only a seat with a
 * call time, set when the floor seated them, sets one: none is made from nothing, as Add time made none.
 */
export function setCallTime(currentMinutes: number, playedMinutes: number, lengthMinutes: number): Result<number, SetCallTimeRefusal> {
  if (!isAddTimeLength(lengthMinutes)) return err('not_a_choice');
  if (!Number.isInteger(currentMinutes) || currentMinutes <= 0) return err('no_call_time');
  const total = wholeMinutesPlayed(playedMinutes) + lengthMinutes;
  if (total > CALL_TIME_CAP_MINUTES) return err('over_a_day');
  return total < currentMinutes ? err('before_call_time') : ok(total);
}

/**
 * Whether the member may set this length now, from what the seat shows them: their call time and the seconds of it left
 * (none once met). Played whole minutes are the call time less the minutes left, rounded up, as the database floors the
 * minutes played; so a length is open when it is at least the minutes left, rounded up.
 */
export function canSetCallTime(lengthMinutes: number, secondsLeft: number): boolean {
  return isAddTimeLength(lengthMinutes) && lengthMinutes >= Math.ceil(Math.max(0, secondsLeft) / 60);
}

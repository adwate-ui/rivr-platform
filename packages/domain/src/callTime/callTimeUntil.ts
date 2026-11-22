import { err, ok, type Result } from '@rivr/contracts/result';
import { CALL_TIME_CAP_MINUTES } from './extension.ts';

/** A seat's call time as the clock-time rule reads it. */
export interface SeatCallClock {
  /** The call time now, in whole minutes; nought for a seat with none. */
  readonly currentMinutes: number;
  /** Seconds played, net of time away, as the database counts them. */
  readonly playedSeconds: number;
  /** The minimum playing time the seat started with, in minutes, before any call time was set. */
  readonly initialMinutes: number;
  /** Whether a call time has been set, by the member or by the floor. */
  readonly isSet: boolean;
}

/**
 * Why a time is refused: a seat with no call time, a time not ahead of now, one not after the minimum playing time (until
 * set) or the current end (once set), or one making more than a day.
 */
export type CallTimeUntilRefusal = 'no_call_time' | 'not_ahead' | 'too_early' | 'over_a_day';

const hasCallTime = (seat: SeatCallClock) => Number.isInteger(seat.currentMinutes) && seat.currentMinutes > 0;

/** Whole seconds played, floored as the database counts them; none, or not a number, counts as nought. */
function wholeSecondsPlayed(played: number): number {
  return Number.isFinite(played) && played > 0 ? Math.floor(played) : 0;
}

/**
 * The seat's call time once a time on the clock is picked for it, `secondsAhead` from now, by the member from the seat or
 * by the floor (the owner, 22 Nov; packages/testing/golden/callTimeUntil.json, which private.call_time_until is proved
 * equal on): the whole seconds played plus those ahead, in minutes rounded up. Until a call time is set, the time must fall
 * after the minimum playing time the seat started with, never before the call time owed now; once set, after the current
 * end. Only a seat with a call time; a day at most in all.
 */
export function callTimeUntil(seat: SeatCallClock, secondsAhead: number): Result<number, CallTimeUntilRefusal> {
  if (!hasCallTime(seat)) return err('no_call_time');
  if (!Number.isFinite(secondsAhead) || secondsAhead <= 0) return err('not_ahead');
  const total = Math.ceil((wholeSecondsPlayed(seat.playedSeconds) + secondsAhead) / 60);
  if (total > CALL_TIME_CAP_MINUTES) return err('over_a_day');
  const isAfter = seat.isSet ? total > seat.currentMinutes : total > seat.initialMinutes && total >= seat.currentMinutes;
  return isAfter ? ok(total) : err('too_early');
}

/**
 * The seconds from now after which a picked time is open (callTimeUntil takes a time strictly later), for the app and the
 * floor to say "after 23:40": the end of the minimum playing time until set, the current end once set; nought once that
 * has passed. Null for a seat with no call time. private.call_time_opens_after is proved equal on the same golden file.
 */
export function callTimeOpensAfter(seat: SeatCallClock): number | null {
  if (!hasCallTime(seat)) return null;
  const bound = seat.isSet ? seat.currentMinutes * 60 : Math.max(seat.initialMinutes * 60, (seat.currentMinutes - 1) * 60);
  return Math.max(0, bound - wholeSecondsPlayed(seat.playedSeconds));
}

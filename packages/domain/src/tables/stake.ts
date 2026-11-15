import { CALL_TIME_CAP_MINUTES } from '../callTime/index.ts';

/** Why a stake may not be given to a table now: it has no call time yet (redesign RD-16). */
export type StakeTableRefusal = 'stake_without_call_time';

/**
 * Whether a stake may be given to a table, and if not why: only once it has a call time above zero. Null when it may.
 * `private.assert_stake_ready` refuses the same (RVNCT).
 */
export function stakeTableRefusal(callTimeMinutes: number): StakeTableRefusal | null {
  return callTimeMinutes > 0 ? null : 'stake_without_call_time';
}

/**
 * Whether minutes may be a stake's call time: whole, above zero and a day at most, as `private.set_stake_call_time`
 * takes them.
 */
export function isStakeCallTime(minutes: number): boolean {
  return Number.isInteger(minutes) && minutes >= 1 && minutes <= CALL_TIME_CAP_MINUTES;
}

import { CALL_TIME_CAP_MINUTES } from '../callTime/index.ts';
import { fromRupees, isChipMultiple, isPositive, type Paise } from '../money/index.ts';

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

/** The most a blind or a straddle may be, 1,00,00,000: `private.assert_blinds_in_reach` refuses more. */
export const BLIND_CEILING: Paise = fromRupees(10_000_000n);

/** Whether an amount may be a blind or a straddle: above zero, a whole 50 and no more than the ceiling, as `table_type` checks. */
export function isBlind(amount: Paise): boolean {
  return isPositive(amount) && isChipMultiple(amount) && amount <= BLIND_CEILING;
}

/** Whether two amounts may be a stake's blinds: each a blind, and the big blind above the small. */
export function areBlinds(smallBlind: Paise, bigBlind: Paise): boolean {
  return isBlind(smallBlind) && isBlind(bigBlind) && bigBlind > smallBlind;
}

/**
 * Whether a stake may have this straddle over its big blind: none, or a blind above the big blind (decision 0299), as
 * `private.assert_straddle` takes it.
 */
export function isStraddle(straddle: Paise | null, bigBlind: Paise): boolean {
  return straddle === null || (isBlind(straddle) && straddle > bigBlind);
}

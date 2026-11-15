import { isChipMultiple, isPositive, times, type Paise } from '../money/index.ts';

/** How many big blinds of its stake a table's suggested minimum buy-in is (owner, 15 Nov). */
export const SUGGESTED_MIN_BUY_IN_BIG_BLINDS = 50n;

/**
 * The minimum buy-in Tables setup suggests for a table of a stake (redesign RD-16): 50 big blinds. Blinds are whole 50s,
 * so it is a whole ₹50 already. A suggestion only: the admin may type another amount, and there is no maximum.
 */
export function suggestedMinBuyIn(bigBlind: Paise): Paise {
  return times(bigBlind, SUGGESTED_MIN_BUY_IN_BIG_BLINDS);
}

/**
 * Whether an amount may be a table's minimum buy-in: above zero and a whole ₹50, as every buy-in on the floor is and the
 * stake's figure was. The table's check `game_table_min_buy_in_whole_fifties` is the same.
 */
export function isMinBuyIn(amount: Paise): boolean {
  return isPositive(amount) && isChipMultiple(amount);
}

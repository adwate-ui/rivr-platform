import { err, ok, type Result } from '@rivr/contracts/result';
import { isChipMultiple, isPositive, min, subtract, type Paise } from '../money/index.ts';

/** How a cash-out splits: each open marker settled (oldest first, as listed), and what is left for the member. */
export interface CashOutSplit {
  readonly settled: readonly Paise[];
  readonly toMember: Paise;
}

/**
 * A cash-out at the cage (scope-v1 module 5; design prompt flow 8): chips handed back, whole ₹50 chips
 * above nothing, first settle the member's open markers, oldest first, each as far as the chips go;
 * the rest goes to the member. `outstanding` lists the markers oldest first; `settled` has one amount
 * for each marker the chips reach. The database's private.cash_out_split is proved equal on
 * packages/testing/golden/cashOut.json.
 */
export function cashOut(chips: Paise, outstanding: readonly Paise[]): Result<CashOutSplit, 'not_chips'> {
  if (!isPositive(chips) || !isChipMultiple(chips)) return err('not_chips');
  let left = chips;
  const settled: Paise[] = [];
  for (const owed of outstanding) {
    if (!isPositive(left)) break;
    const paid = min(left, owed);
    settled.push(paid);
    left = subtract(left, paid);
  }
  return ok({ settled, toMember: left });
}

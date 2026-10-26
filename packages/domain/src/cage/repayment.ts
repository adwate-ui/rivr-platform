import { err, ok, type Result } from '@rivr/contracts/result';
import { isZero, sum } from '../money/index.ts';
import type { Paise } from '../money/index.ts';
import { cashOut } from './cashOut.ts';

/** Why a repayment is refused: not whole ₹50 chips (or nothing), nothing owed, or more than is owed. */
export type RepaymentRefusal = 'not_chips' | 'nothing_owed' | 'more_than_owed';

/**
 * A marker repayment at the cage (#92; scope-v1 module 5: "partial repayment by cash or UPI"): money in
 * whole ₹50 chips above nothing settles the member's open markers oldest first, each as far as it goes,
 * exactly as a cash-out's chips do (cashOut), and never more than they owe in all. `outstanding` lists
 * the markers oldest first; the result has one settled amount for each marker the money reaches. The
 * database's private.repayment_split is proved equal on packages/testing/golden/creditAgeing.json.
 */
export function repayment(amount: Paise, outstanding: readonly Paise[]): Result<readonly Paise[], RepaymentRefusal> {
  const split = cashOut(amount, outstanding);
  if (!split.ok) return err('not_chips');
  if (isZero(sum(outstanding))) return err('nothing_owed');
  if (!isZero(split.value.toMember)) return err('more_than_owed');
  return ok(split.value.settled);
}

import { err, ok, type Result } from '@rivr/contracts/result';
import { compare, isChipMultiple, isNegative, type Paise } from '../money/index.ts';

/** A limit in force at once, or waiting for a super admin's approval. */
export type CreditLimitState = 'active' | 'needs_approval';

/**
 * A member's credit limit as the floor sets it (scope-v1 module 5, "Credit lines to players"): whole
 * ₹50 chips, or nothing to close the line. A limit no higher than the venue's credit.approval
 * threshold, or no higher than the limit in force (a cut), is in force at once; a raise above the
 * threshold waits for a super admin other than the one who asked, whoever asks. The database's
 * private.credit_limit_check is proved equal on packages/testing/golden/credit.json.
 */
export function creditLimit(limit: Paise, threshold: Paise, current: Paise): Result<CreditLimitState, 'not_chips'> {
  if (isNegative(limit) || !isChipMultiple(limit)) return err('not_chips');
  return ok(compare(limit, threshold) > 0 && compare(limit, current) > 0 ? 'needs_approval' : 'active');
}

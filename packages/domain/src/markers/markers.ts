import { err, ok, type Result } from '@rivr/contracts/result';
import { add, compare, isChipMultiple, isPositive, type Paise } from '../money/index.ts';

/** What a marker is checked against: the member's open markers and limit, the room's open markers and cap, and whether one of theirs is past due. */
export interface MarkerTerms {
  readonly outstanding: Paise;
  readonly limit: Paise;
  readonly exposure: Paise;
  readonly cap: Paise;
  readonly isPastDue: boolean;
}

/** Why a marker is refused: not whole chips (or nothing), a marker past due, above the member's limit, or above the room's cap. */
export type MarkerRefusal = 'not_chips' | 'past_due' | 'above_limit' | 'above_exposure';

/**
 * A marker at the cage (scope-v1 module 5; additions flow 19): chips on credit, whole ₹50 chips above
 * nothing, refused while a marker of the member's is past due, above their credit limit, or above
 * the room's exposure cap (exactly at either is allowed). The database's private.marker_check is
 * proved equal on packages/testing/golden/markers.json.
 */
export function markerCheck(amount: Paise, terms: MarkerTerms): Result<null, MarkerRefusal> {
  if (!isPositive(amount) || !isChipMultiple(amount)) return err('not_chips');
  if (terms.isPastDue) return err('past_due');
  if (compare(add(terms.outstanding, amount), terms.limit) > 0) return err('above_limit');
  if (compare(add(terms.exposure, amount), terms.cap) > 0) return err('above_exposure');
  return ok(null);
}

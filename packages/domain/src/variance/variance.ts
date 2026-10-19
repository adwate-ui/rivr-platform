import { compare, isNegative, negate, subtract, ZERO, type Paise } from '../money/index.ts';

/** What a down's drop-box count shows against its hands (#44). */
export interface DownVariance {
  /** The count less the rake and jackpot drops logged: below zero when the box is short. */
  readonly variance: Paise;
  /** Beyond the threshold either way: the floor and the owner are alerted. */
  readonly isAlert: boolean;
}

/**
 * A dealer's down at its end (scope-v1 module 4): the drop-box count less the rake and jackpot drops
 * its hands logged, and whether that is beyond the threshold either way. Exactly at the threshold is
 * no alert; with no threshold set, any variance is one. The database's private.down_variance is
 * proved equal by the same golden cases (packages/testing/golden/variance.json).
 */
export function downVariance(dropBox: Paise, logged: Paise, threshold: Paise | null): DownVariance {
  const variance = subtract(dropBox, logged);
  const size = isNegative(variance) ? negate(variance) : variance;
  return { variance, isAlert: compare(size, threshold ?? ZERO) > 0 };
}

import { fromPaise, type Paise } from './paise.ts';

const WHOLE_IN_BASIS_POINTS = 10_000n;

/**
 * A share of `amount` in basis points (500 is 5%), rounded down to the paisa: 5% of ₹48,000 is
 * ₹2,400. Rake, bonuses and fees build on this. Throws on a negative amount or a rate outside 0%
 * to 100%, because either is a bug in the caller.
 */
export function shareOf(amount: Paise, basisPoints: bigint): Paise {
  if (amount < 0n) throw new RangeError(`Cannot take a share of a negative amount (${amount} paise)`);
  if (basisPoints < 0n || basisPoints > WHOLE_IN_BASIS_POINTS) {
    throw new RangeError(`A share must be between 0 and 10,000 basis points, not ${basisPoints}`);
  }
  // Both factors are non-negative, so bigint division truncates down.
  return fromPaise((amount * basisPoints) / WHOLE_IN_BASIS_POINTS);
}

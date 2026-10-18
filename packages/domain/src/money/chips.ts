import { fromPaise, fromRupees, type Paise } from './paise.ts';

/** The smallest chip on the floor, ₹50. Every pot, buy-in, cash-out and rake is a whole number of them. */
export const CHIP: Paise = fromRupees(50n);

/**
 * Rounds down to a whole number of ₹50 chips: ₹2,449.50 becomes ₹2,400. Rake, jackpot drops and
 * pulls use this. Throws on a negative amount, because that is a bug in the caller.
 */
export function roundDownToChip(amount: Paise): Paise {
  if (amount < 0n) throw new RangeError(`Cannot round a negative amount to chips (${amount} paise)`);
  return fromPaise(amount - (amount % CHIP));
}

/** True when the amount can be paid in ₹50 chips, as every tablet and cage entry must be. */
export function isChipMultiple(amount: Paise): boolean {
  return amount % CHIP === 0n;
}

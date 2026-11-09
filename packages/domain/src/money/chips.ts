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

/** What one chip is worth where the console counts blinds and bonus chips: ₹1, not the ₹50 chip paid on the floor. */
const PAISE_PER_CHIP = 100n;

/**
 * Money as a count of chips of ₹1, as blinds are typed and bonus chips shown: ₹5,000 is 5,000 chips. Part of a chip is
 * dropped, as nothing rounds up. Throws on a negative amount, because that is a bug in the caller.
 */
export function paiseToChips(amount: Paise): bigint {
  if (amount < 0n) throw new RangeError(`Cannot count a negative amount as chips (${amount} paise)`);
  return amount / PAISE_PER_CHIP;
}

/** A count of chips of ₹1 as money: 5,000 chips are ₹5,000. Throws on a negative count, because that is a bug in the caller. */
export function chipsToPaise(chips: bigint): Paise {
  if (chips < 0n) throw new RangeError(`Cannot make money of a negative count of chips (${chips})`);
  return fromPaise(chips * PAISE_PER_CHIP);
}

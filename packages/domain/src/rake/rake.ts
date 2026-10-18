import { add, min, roundDownToChip, shareOf, ZERO, type Paise } from '../money/index.ts';

/** A table type's rake rules in force (effective-dated configuration), with the jackpot's state. */
export interface RakeRules {
  /** The rate of the pot, in basis points: 500 is 5%. */
  readonly rateBasisPoints: bigint;
  /** The most rake one pot gives, for this table type. */
  readonly cap: Paise;
  /** True while the bad-beat jackpot is live: only then is anything dropped into it. */
  readonly isJackpotLive: boolean;
  /** What is dropped into the jackpot from a pot above `dropAbove`: ₹100. */
  readonly drop: Paise;
  /** Pots above this, not at it, give the drop: ₹5,000. */
  readonly dropAbove: Paise;
}

/** What the house takes from one pot: the rake, the jackpot drop, and the pull, both together. */
export interface PotTake {
  readonly rake: Paise;
  readonly drop: Paise;
  readonly pull: Paise;
}

/**
 * What the dealer takes from a pot (scope-v1 module 4). Rake is the rate of the pot, no more than
 * the cap, rounded down to whole ₹50 chips. While the jackpot is live, a pot above `dropAbove`
 * also drops `drop` (in whole chips) into it. The pull is the two together. Nothing rounds up.
 * Throws on a negative pot, because that is a bug in the caller.
 */
export function potTake(pot: Paise, rules: RakeRules): PotTake {
  if (pot < 0n) throw new RangeError(`A pot cannot be negative (${pot} paise)`);
  const rake = roundDownToChip(min(shareOf(pot, rules.rateBasisPoints), rules.cap));
  const drop = rules.isJackpotLive && pot > rules.dropAbove ? roundDownToChip(rules.drop) : ZERO;
  return { rake, drop, pull: add(rake, drop) };
}

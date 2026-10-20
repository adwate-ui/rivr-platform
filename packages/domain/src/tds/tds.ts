import { compare, fromPaise, max, min, shareOf, subtract, ZERO, type Paise } from '../money/index.ts';

const RUPEE = 100n;

/** The TDS parameters in force (setting `tds.config`), as the rule uses them. */
export interface TdsRule {
  /** The rate in basis points: 3000 is 30%. */
  readonly rate: bigint;
  /** The period's net winnings must exceed this before any TDS is due. */
  readonly threshold: Paise;
  /** Whether a member without a PAN on record is taxed at `noPanRate` instead. */
  readonly panRequired: boolean;
  readonly noPanRate: bigint;
}

/** A cash-out as TDS sees it. */
export interface TdsCashOut {
  /** The period's net winnings with this cash-out: chips cashed out less chips bought. Below zero when down. */
  readonly winnings: Paise;
  /** TDS already recorded in the period, withheld or shadow. */
  readonly already: Paise;
  /** What this cash-out pays the member once markers are settled: no more can be withheld from it. */
  readonly payout: Paise;
  readonly hasPan: boolean;
}

/** TDS on a cash-out: the rate applied, what the period owes in all, and what this cash-out bears. */
export interface Tds {
  readonly rate: bigint;
  readonly due: Paise;
  readonly amount: Paise;
}

/**
 * TDS on a cash-out (scope-v1 module 5, "TDS engine"; decision 0068). Nothing is due until the period's
 * net winnings exceed the threshold; then the rate (the no-PAN rate for a member without a PAN where one
 * is required) applies to all of them, rounded down to the rupee. This cash-out bears what the period
 * owes less what was already recorded in it, never below nothing and never more than it pays the member.
 * The database's private.tds_amount is proved equal by the same golden cases (packages/testing/golden/tds.json).
 */
export function tdsOnCashOut(cashOut: TdsCashOut, rule: TdsRule): Tds {
  const rate = rule.panRequired && !cashOut.hasPan ? rule.noPanRate : rule.rate;
  // The threshold is never below nothing, so winnings above it are always positive.
  const share = compare(cashOut.winnings, rule.threshold) > 0 ? shareOf(cashOut.winnings, rate) : ZERO;
  const due = fromPaise(share - (share % RUPEE));
  const amount = min(max(subtract(due, cashOut.already), ZERO), cashOut.payout);
  return { rate, due, amount };
}

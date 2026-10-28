import type { Paise } from '../money/index.ts';

/** A prize on the wheel: points, bonus in paise, or nothing; and its weight, its odds among the others. */
export interface SpinPrize {
  readonly kind: 'points' | 'bonus' | 'nothing';
  /** Points for points, paise for a bonus, 0 for nothing. */
  readonly amount: bigint;
  readonly weight: bigint;
}

/** Whether a prize can be drawn: a bonus only while what is left of the month's spin budget covers it. */
export function isDrawable(prize: SpinPrize, budgetLeft: Paise): boolean {
  return prize.kind !== 'bonus' || prize.amount <= budgetLeft;
}

/** The odds a spin is out of: the weights of the prizes that can be drawn; 0 when none can. */
export function spinOdds(prizes: readonly SpinPrize[], budgetLeft: Paise): bigint {
  return prizes.filter((prize) => isDrawable(prize, budgetLeft)).reduce((odds, prize) => odds + prize.weight, 0n);
}

/**
 * The spin wheel (#150; additions "Spin wheel"; decision 0266): a roll from 0 to the odds less one lands on the prizes
 * that can be drawn, in the wheel's order, each taking as many rolls as its weight. A bonus more than what is left of
 * the club month's spin budget is left off the wheel for that spin. The place of the prize won (from 0), or null when
 * nothing can be drawn. The database's private.spin_prize is proved equal on packages/testing/golden/spin.json.
 */
export function spinPrize(prizes: readonly SpinPrize[], budgetLeft: Paise, roll: bigint): number | null {
  if (prizes.some((prize) => prize.weight < 1n || prize.amount < 0n)) throw new RangeError('Weights are at least 1 and amounts never negative');
  const odds = spinOdds(prizes, budgetLeft);
  if (odds === 0n) return null;
  if (roll < 0n || roll >= odds) throw new RangeError('A roll is from 0 to the odds less one');
  let left = roll;
  for (const [place, prize] of prizes.entries()) {
    if (isDrawable(prize, budgetLeft)) {
      if (left < prize.weight) return place;
      left -= prize.weight;
    }
  }
  return null;
}

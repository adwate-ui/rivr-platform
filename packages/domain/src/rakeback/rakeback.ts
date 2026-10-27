import { fromPaise, min, roundDownToChip, shareOf, type Paise } from '../money/index.ts';
import { rakeShare } from '../points/points.ts';

/** One hand of the week: its table's stake (a table type code), its rake, and the members seated at the table when it was played. */
export interface RakeHand {
  readonly stake: string;
  readonly rake: Paise;
  readonly seated: readonly string[];
}

/**
 * Each member's rake at each stake over a club week (#108, decision 0245): every hand's rake split equally among the
 * members seated at its table when it was played, rounded down to the paisa per hand as RIVR Rewards splits it
 * (decision 0161), and summed by member and stake. packages/testing/golden/rakeback.json proves the split and the sum
 * against private.rake_share summed, as private.week_rake_shares sums it; who sat where is tested by 147_rakeback.
 */
export function weekRakeShares(hands: readonly RakeHand[]): Map<string, Map<string, Paise>> {
  const shares = new Map<string, Map<string, Paise>>();
  for (const hand of hands) {
    if (hand.seated.length === 0) continue;
    const share = rakeShare(hand.rake, BigInt(hand.seated.length));
    for (const member of hand.seated) {
      const stakes = shares.get(member) ?? new Map<string, Paise>();
      stakes.set(hand.stake, fromPaise((stakes.get(hand.stake) ?? 0n) + share));
      shares.set(member, stakes);
    }
  }
  return shares;
}

/**
 * A member's rakeback for a week at one stake: the stake's rakeback.rate (basis points, 1,000 is 10%) of their rake
 * there, rounded down to whole ₹50 chips, then held to the cap, as a promotion's percentage bonus is. ₹0 when it comes
 * to less than a chip, or the rate is 0.
 */
export function rakebackBonus(share: Paise, rateBasisPoints: bigint, cap?: Paise): Paise {
  const bonus = roundDownToChip(shareOf(share, rateBasisPoints));
  return cap === undefined ? bonus : min(bonus, cap);
}

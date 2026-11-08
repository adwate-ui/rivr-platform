/** A reward's price: points, or whole hotel nights. */
export interface RewardPrice {
  readonly points: bigint | null;
  readonly nights: number | null;
}

/** What a member holds: points, and hotel nights in thousandths, as the ledger keeps them. */
export interface RewardsHeld {
  readonly points: bigint;
  readonly nights: bigint;
}

/** How far short of a reward a member is: in points, or in thousandths of a hotel night. */
export interface RewardShortfall {
  readonly unit: 'points' | 'nights';
  readonly short: bigint;
}

const THOUSANDTHS_A_NIGHT = 1000n;

/** How far short a member is of a reward, in what it is priced in (F-046); null when they hold enough. */
export function rewardShortfall(price: RewardPrice, held: RewardsHeld): RewardShortfall | null {
  if (price.nights !== null) {
    const short = BigInt(price.nights) * THOUSANDTHS_A_NIGHT - held.nights;
    return short > 0n ? { unit: 'nights', short } : null;
  }
  const short = (price.points ?? 0n) - held.points;
  return short > 0n ? { unit: 'points', short } : null;
}

import { fromPaise, type Paise } from '../money/index.ts';
import { rakeShare } from '../points/points.ts';
import { promotionReward } from '../promotions/promotions.ts';

/** One hand of the week at a table: its rake, and the members seated at the table when it was played. */
export interface RakeHand {
  readonly tableId: string;
  readonly rake: Paise;
  readonly seated: readonly string[];
}

/**
 * Each member's rake at each table over a club week (#108): every hand's rake split equally among the members seated
 * at its table when it was played, rounded down to the paisa per hand as RIVR Rewards splits it (decision 0161), and
 * summed by member and table. The database's private.week_rake_shares is proved equal by
 * packages/testing/golden/rakeback.json.
 */
export function weekRakeShares(hands: readonly RakeHand[]): Map<string, Map<string, Paise>> {
  const shares = new Map<string, Map<string, Paise>>();
  for (const hand of hands) {
    if (hand.seated.length === 0) continue;
    const share = rakeShare(hand.rake, BigInt(hand.seated.length));
    for (const member of hand.seated) {
      const tables = shares.get(member) ?? new Map<string, Paise>();
      tables.set(hand.tableId, fromPaise((tables.get(hand.tableId) ?? 0n) + share));
      shares.set(member, tables);
    }
  }
  return shares;
}

/**
 * A member's rakeback for the week at one table: the rule's rate (basis points, 1,000 is 10%) of their rake there,
 * rounded down to whole ₹50 chips and held to the cap, exactly as the engine's percentage bonus gives it, since a
 * rakeback is that bonus on the week's rake (question #485). ₹0 when it comes to less than a chip.
 */
export function rakebackBonus(share: Paise, rateBasisPoints: number, capPaise?: number): Paise {
  const effect = { kind: 'bonus' as const, percent_bps: rateBasisPoints, expires_days: 7, ...(capPaise === undefined ? {} : { cap_paise: capPaise }) };
  return promotionReward(effect, { amount: share, points: 0n })?.cost ?? fromPaise(0n);
}

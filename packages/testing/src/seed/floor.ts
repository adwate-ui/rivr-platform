import { paise } from '../paise.ts';
import { tables } from './tables.ts';
import { ist } from './time.ts';
import type { SeedHighHand, SeedPromotion } from './types.ts';

/** The bad-beat jackpot, ₹3,42,600. */
export const badBeatJackpot = paise(34_260_000n);

/** Tonight's high hand: four of a kind, queens, Table 2, 22:18, ₹2,000. */
export const highHand: SeedHighHand = {
  hand: 'Four of a kind, queens',
  tableId: tables.table2.id,
  at: ist('2026-11-16 22:18'),
  prize: paise(200_000n),
};

/** The two live promotions. */
export const promotions: readonly SeedPromotion[] = [
  {
    kind: 'high_hand',
    title: 'High hands',
    prizes: {
      royalFlush: paise(2_500_000n), // ₹25,000
      straightFlush: paise(1_000_000n), // ₹10,000
      fourOfAKind: paise(200_000n), // ₹2,000
    },
  },
  { kind: 'referral', title: 'Referral', rewardEachSide: paise(100_000n) }, // ₹1,000
];

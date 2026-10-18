import { paise } from '../paise.ts';
import { tables } from './tables.ts';
import { ist } from './time.ts';
import type { SeedHighHand, SeedPromotion, SeedTournament } from './types.ts';

/** The bad-beat jackpot, ₹3,42,600. */
export const badBeatJackpot = paise(34_260_000n);

/** Tonight's high hand: four of a kind, queens, Table 2, 22:18, ₹2,000. */
export const highHand: SeedHighHand = {
  hand: 'Four of a kind, queens',
  tableId: tables.table2.id,
  at: ist('2026-11-16 22:18'),
  prize: paise(200_000n),
};

/** RIVR Sunday at level 7 with 11:40 left: 58 entries of ₹9,000 to the pool, 31 players left. */
export const tournament: SeedTournament = {
  name: 'RIVR Sunday',
  buyIn: paise(1_000_000n), // ₹10,000
  toPool: paise(900_000n), // ₹9,000
  fee: paise(100_000n), // ₹1,000
  reEntryUntilLevel: 9,
  levelMinutes: 20,
  level: 7,
  blinds: { small: 400, big: 800, ante: 800 },
  secondsLeftInLevel: 11 * 60 + 40,
  entries: 58,
  playersLeft: 31,
  pool: paise(52_200_000n), // ₹5,22,000
  guarantee: paise(50_000_000n), // ₹5,00,000
  placesPaid: 8,
};

/** The three live promotions. */
export const promotions: readonly SeedPromotion[] = [
  {
    kind: 'buy_in_bonus',
    title: 'Buy-in bonus Tuesday',
    weekday: 'tuesday',
    bonusBasisPoints: 2_000n, // 20%
    firstBuyInsPerTable: 5,
  },
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

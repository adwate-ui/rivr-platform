import { describe, expect, it } from 'vitest';
import { designPromptSeed as seed } from './index.ts';
import { ist } from './time.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('ist', () => {
  it('turns an IST wall-clock time into the UTC instant', () => {
    expect(ist('2026-11-17 00:10').toISOString()).toBe('2026-11-16T18:40:00.000Z');
  });

  it('throws on text that is not a time', () => {
    expect(() => ist('Tuesday')).toThrow(/Not an IST time: Tuesday/);
  });
});

describe('design prompt seed: tables', () => {
  const { table1, table2, table3, table4, table5, privateRoom } = seed.tables;

  it('has six tables in floor order', () => {
    expect(Object.values(seed.tables).map((table) => table.name)).toEqual([
      'Table 1',
      'Table 2',
      'Table 3',
      'Table 4',
      'Table 5',
      'Private Room',
    ]);
    expect(new Set(Object.values(seed.tables).map((table) => table.id)).size).toBe(6);
  });

  it('runs Table 1 as NLH 50/100, ₹5,000 buy-in, 5% rake capped at ₹3,000, 6 of 9 seated', () => {
    expect(table1).toMatchObject({ game: 'NLH', buyIn: 500_000n, rakeBasisPoints: 500n, rakeCap: 300_000n });
    expect(table1.stakes).toEqual({ smallBlind: 5_000n, bigBlind: 10_000n });
    expect([table1.seated, table1.seats, table1.isOpen]).toEqual([6, 9, true]);
  });

  it('runs Tables 2 to 5 as NLH + variation 100/200, ₹10,000, cap ₹6,000', () => {
    for (const table of [table2, table3, table4, table5]) {
      expect(table).toMatchObject({ game: 'NLH + variation', buyIn: 1_000_000n, rakeCap: 600_000n, straddle: null });
      expect(table.stakes).toEqual({ smallBlind: 10_000n, bigBlind: 20_000n });
    }
    expect([table2.seated, table3.seated]).toEqual([9, 8]);
    expect([table4.isOpen, table4.seated]).toEqual([false, 0]);
    expect([table5.isOpen, table5.seated]).toEqual([true, 0]);
  });

  it('runs the Private Room with a ₹500 straddle, ₹20,000 buy-in, cap ₹12,000, 7 of 9 seated', () => {
    expect(privateRoom).toMatchObject({ straddle: 50_000n, buyIn: 2_000_000n, rakeCap: 1_200_000n, seated: 7 });
    expect(privateRoom.game).toBe('NLH + ₹500 straddle');
  });

  it('puts every table in the real venue, not the practice venue', () => {
    expect(seed.venue.isPractice).toBe(false);
    expect(seed.practiceVenue.isPractice).toBe(true);
    for (const table of Object.values(seed.tables)) expect(table.venueId).toBe(seed.venue.id);
  });
});

describe('design prompt seed: people', () => {
  const { arjun, kabir, naina, rohan } = seed.members;

  it('lists the 100/200 waitlist in join order', () => {
    expect(seed.waitlist.map((entry) => entry.memberId)).toEqual([kabir.id, naina.id, rohan.id]);
    expect(seed.waitlist.map((entry) => entry.joinedAt)).toEqual([
      ist('2026-11-16 23:52'),
      ist('2026-11-16 23:58'),
      ist('2026-11-17 00:07'),
    ]);
    for (const entry of seed.waitlist) expect(entry.stakes).toEqual(seed.tables.table2.stakes);
  });

  it('makes Arjun Mehta a black card qualifying at 100/200', () => {
    expect(arjun).toMatchObject({ name: 'Arjun Mehta', tier: 'black_card' });
    expect(arjun.qualifyingStakes).toEqual(seed.tables.table3.stakes);
  });

  it('gives Arjun the balances the flows compute from', () => {
    expect(seed.arjun.cash).toBe(18_500_000n);
    expect(seed.arjun.bonus).toEqual({ amount: 400_000n, expiresAt: ist('2026-11-22 23:59') });
    expect(seed.arjun.openMarker.amount).toBe(5_000_000n);
    expect(seed.clock.getTime() - seed.arjun.openMarker.issuedAt.getTime()).toBe(14 * DAY_MS);
    expect(seed.arjun.creditLimit).toBe(20_000_000n);
    expect([seed.arjun.points, seed.arjun.visitsThisMonth]).toEqual([18_420, 5]);
    expect(seed.arjun.payoutAccount).toEqual({ bankName: 'HDFC Bank', vpa: 'arjun.mehta@hdfcbank', isVerified: true });
  });

  it('puts Pema Lepcha on Table 3 from 23:40', () => {
    expect(seed.dealer.name).toBe('Pema Lepcha');
    expect(seed.dealerDown).toEqual({
      dealerId: seed.dealer.id,
      tableId: seed.tables.table3.id,
      startedAt: ist('2026-11-16 23:40'),
    });
  });
});

describe('design prompt seed: the floor tonight', () => {
  it('starts the clock at Tuesday 00:10 IST', () => {
    expect(seed.clock.toISOString()).toBe('2026-11-16T18:40:00.000Z');
    expect(seed.clock.getUTCDay()).toBe(1); // Monday in UTC is Tuesday 00:10 in IST.
  });

  it('holds ₹3,42,600 in the bad-beat jackpot and a ₹2,000 high hand on Table 2 at 22:18', () => {
    expect(seed.badBeatJackpot).toBe(34_260_000n);
    expect(seed.highHand).toEqual({
      hand: 'Four of a kind, queens',
      tableId: seed.tables.table2.id,
      at: ist('2026-11-16 22:18'),
      prize: 200_000n,
    });
  });

  it('runs RIVR Sunday with 58 entries building a ₹5,22,000 pool against a ₹5,00,000 guarantee', () => {
    const { tournament } = seed;
    expect(tournament.toPool + tournament.fee).toBe(tournament.buyIn);
    expect(tournament.pool).toBe(tournament.toPool * BigInt(tournament.entries));
    expect(tournament).toMatchObject({ pool: 52_200_000n, guarantee: 50_000_000n, playersLeft: 31, placesPaid: 8 });
    expect(tournament).toMatchObject({ level: 7, levelMinutes: 20, reEntryUntilLevel: 9, secondsLeftInLevel: 700 });
    expect(tournament.blinds).toEqual({ small: 400, big: 800, ante: 800 });
  });

  it('runs the three live promotions', () => {
    expect(seed.promotions).toEqual([
      { kind: 'buy_in_bonus', title: 'Buy-in bonus Tuesday', weekday: 'tuesday', bonusBasisPoints: 2_000n, firstBuyInsPerTable: 5 },
      {
        kind: 'high_hand',
        title: 'High hands',
        prizes: { royalFlush: 2_500_000n, straightFlush: 1_000_000n, fourOfAKind: 200_000n },
      },
      { kind: 'referral', title: 'Referral', rewardEachSide: 100_000n },
    ]);
  });
});

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CHIP, fromPaise, type Paise } from '../money/index.ts';
import { chipChop, DEAL_METHODS, dealAmounts, MOST_DEAL_PLAYERS } from './deals.ts';
import { areSharesWhole, BOUNTY_KINDS, bountyOnBust, MOST_PLACES, payoutTable, prizePool, satelliteSeats, WHOLE_POOL } from './payouts.ts';

/** An amount of ₹50 chips, up to ₹1 crore. */
const chips = fc.bigInt({ min: 0n, max: 200_000n }).map((count) => fromPaise(count * CHIP));
const sum = (values: readonly bigint[]) => values.reduce((total, value) => total + value, 0n);

/** A deal: two to nine stacks, and as many prizes, first place first. */
const deal = fc.integer({ min: 2, max: MOST_DEAL_PLAYERS }).chain((players) => fc.record({
  stacks: fc.array(fc.bigInt({ min: 1n, max: 5_000_000n }), { minLength: players, maxLength: players }),
  prizes: fc.array(chips, { minLength: players, maxLength: players }).map((prizes): Paise[] => [...prizes].sort((a, b) => (a > b ? -1 : a < b ? 1 : 0))),
}));

describe('prizePool properties', () => {
  it('is at least what came in and the guarantee, the overlay the difference', () => {
    fc.assert(fc.property(chips, fc.option(chips, { nil: null }), (collected, guarantee) => {
      const found = prizePool(collected, guarantee);
      expect(found.pool >= collected && found.pool >= (guarantee ?? 0n)).toBe(true);
      expect(found.overlay).toBe(found.pool - collected);
    }));
  });
});

/** One to a hundred shares above nothing adding up to 100%, the larger first: cuts of the whole pool, as basis points. */
const shares = fc.uniqueArray(fc.integer({ min: 1, max: WHOLE_POOL - 1 }), { maxLength: MOST_PLACES - 1 })
  .map((cuts) => [0, ...[...cuts].sort((a, b) => a - b), WHOLE_POOL])
  .map((edges) => edges.slice(1).map((edge, index) => edge - (edges[index] ?? 0)).sort((a, b) => b - a));

describe('payoutTable properties', () => {
  it('pays the whole pool in ₹50 chips, a prize for each place a run can take, each within a chip of its share', () => {
    fc.assert(fc.property(chips, shares, fc.integer({ min: 1, max: 200 }), (pool, set, runs) => {
      const prizes = payoutTable(pool, set, runs);
      const paid = set.slice(0, runs);
      const weight = BigInt(paid.reduce((total, share) => total + share, 0));
      expect(prizes).toHaveLength(Math.min(set.length, runs));
      expect(sum(prizes)).toBe(pool);
      prizes.slice(1).forEach((prize, index) => {
        const exact = (pool * BigInt(paid[index + 1] ?? 0)) / weight;
        expect(prize % CHIP === 0n && prize <= exact && exact - prize < CHIP).toBe(true);
      });
    }));
  });

  it('refuses shares that do not add up to 100%', () => {
    fc.assert(fc.property(shares, fc.integer({ min: 1, max: 50 }), (set, extra) => {
      expect(() => payoutTable(fromPaise(0n), [...set.slice(0, -1), (set[set.length - 1] ?? 0) + extra], 3)).toThrow(RangeError);
      expect(areSharesWhole(set)).toBe(true);
    }));
  });
});

describe('deal properties', () => {
  it('shares exactly the prizes left, in ₹50 chips, each at least the smallest prize, more chips never less', () => {
    fc.assert(fc.property(deal, fc.constantFrom(...DEAL_METHODS), ({ stacks, prizes }, method) => {
      const amounts = dealAmounts(method, stacks, prizes);
      const smallest = prizes[prizes.length - 1] ?? 0n;
      expect(sum(amounts)).toBe(sum(prizes));
      expect(amounts.every((amount) => amount % CHIP === 0n && amount >= smallest)).toBe(true);
      stacks.forEach((stack, one) => stacks.forEach((other, two) => {
        if (stack > other) expect(amounts[one] ?? 0n).toBeGreaterThanOrEqual(amounts[two] ?? 0n);
      }));
    }));
  });

  it('refuses a deal with a player for whom there is no prize', () => {
    expect(() => chipChop([1n, 2n, 3n], [fromPaise(5000n), fromPaise(5000n)])).toThrow(RangeError);
  });
});

describe('bountyOnBust properties', () => {
  it('pays and moves to the head exactly the bounty, paying all of a standard one and at most half of a progressive one', () => {
    fc.assert(fc.property(chips, fc.constantFrom(...BOUNTY_KINDS), (bounty, kind) => {
      const split = bountyOnBust(bounty, kind);
      expect(split.paid + split.toHead).toBe(bounty);
      expect(split.paid % CHIP).toBe(0n);
      if (kind === 'standard') expect(split.toHead).toBe(0n);
      else expect(split.paid * 2n <= bounty && split.toHead - split.paid <= CHIP).toBe(true);
    }));
  });
});

describe('satelliteSeats properties', () => {
  it('pays the whole pool as seats and cash left over, a seat for no more runs than there are, and less than a seat in cash while a run has none', () => {
    const buyIn = fc.bigInt({ min: 1n, max: 20_000n }).map((count) => fromPaise(count * CHIP));
    fc.assert(fc.property(chips, buyIn, fc.integer({ min: 1, max: 500 }), (pool, price, runs) => {
      const found = satelliteSeats(pool, price, runs);
      expect(BigInt(found.seats) * price + found.leftover).toBe(pool);
      expect(found.seats >= 0 && found.seats <= runs && found.leftover % CHIP === 0n).toBe(true);
      if (found.seats < runs) expect(found.leftover < price && found.leftoverPlace === found.seats + 1).toBe(true);
      else expect(found.leftoverPlace).toBe(runs);
    }));
  });
});

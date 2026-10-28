import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fromPaise } from '../money/index.ts';
import { isDrawable, spinOdds, spinPrize, type SpinPrize } from './spin.ts';

const prize: fc.Arbitrary<SpinPrize> = fc.record({
  kind: fc.constantFrom('points' as const, 'bonus' as const, 'nothing' as const),
  amount: fc.bigInt({ min: 0n, max: 10n }).map((chips) => chips * 5_000n),
  weight: fc.bigInt({ min: 1n, max: 6n }),
});
const wheel = fc.array(prize, { maxLength: 6 });
const budget = fc.bigInt({ min: 0n, max: 60_000n }).map(fromPaise);

describe('spinPrize', () => {
  it('gives each prize that can be drawn exactly its weight of the rolls, and none to a bonus past the budget', () => {
    fc.assert(fc.property(wheel, budget, (prizes, left) => {
      const odds = spinOdds(prizes, left);
      const won = new Map<number, bigint>();
      for (let roll = 0n; roll < odds; roll += 1n) {
        const place = spinPrize(prizes, left, roll);
        expect(place).not.toBeNull();
        won.set(place ?? -1, (won.get(place ?? -1) ?? 0n) + 1n);
      }
      prizes.forEach((each, place) => expect(won.get(place) ?? 0n).toBe(isDrawable(each, left) ? each.weight : 0n));
      if (odds === 0n) expect(spinPrize(prizes, left, 0n)).toBeNull();
    }));
  });
});

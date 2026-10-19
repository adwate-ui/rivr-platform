import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fromPaise } from '../money/index.ts';
import { cashOut } from './cashOut.ts';

const chips = fc.bigInt({ min: 1n, max: 200_000n }).map((count) => fromPaise(count * 5_000n));
const markers = fc.array(chips, { maxLength: 5 });

describe('cashOut properties', () => {
  it('pays back no more than is owed and gives the rest to the member: nothing is lost or made', () => {
    fc.assert(fc.property(chips, markers, (handedBack, owed) => {
      const split = cashOut(handedBack, owed);
      if (!split.ok) throw new Error('whole chips are always cashed out');
      const settled = split.value.settled.reduce((sum, paid) => sum + paid, 0n);
      expect(settled + split.value.toMember).toBe(handedBack);
      split.value.settled.forEach((paid, index) => expect(paid <= (owed[index] ?? 0n)).toBe(true));
    }));
  });

  it('gives the member nothing while a marker is left unsettled, and settles markers oldest first', () => {
    fc.assert(fc.property(chips, markers, (handedBack, owed) => {
      const split = cashOut(handedBack, owed);
      if (!split.ok) return;
      const fullyPaid = split.value.settled.filter((paid, index) => paid === owed[index]).length;
      if (split.value.toMember > 0n) expect(fullyPaid).toBe(owed.length);
      // Only the last marker reached may be part-paid.
      split.value.settled.slice(0, -1).forEach((paid, index) => expect(paid).toBe(owed[index]));
    }));
  });

  it('refuses nothing, or what is not whole chips', () => {
    expect(cashOut(fromPaise(0n), [])).toEqual({ ok: false, error: 'not_chips' });
    expect(cashOut(fromPaise(1_002_000n), [])).toEqual({ ok: false, error: 'not_chips' });
  });
});

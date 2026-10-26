import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fromPaise } from '../money/index.ts';
import { repayment } from './repayment.ts';

const chips = fc.bigInt({ min: 1n, max: 200_000n }).map((count) => fromPaise(count * 5_000n));

describe('repayment properties', () => {
  it('settles exactly what is paid, never more than any marker owes, oldest first', () => {
    fc.assert(fc.property(chips, fc.array(chips, { minLength: 1, maxLength: 5 }), (paid, owed) => {
      const result = repayment(paid, owed);
      const total = owed.reduce((sum, amount) => sum + amount, 0n);
      if (paid > total) {
        expect(result).toEqual({ ok: false, error: 'more_than_owed' });
        return;
      }
      if (!result.ok) throw new Error('a repayment within what is owed goes through');
      expect(result.value.reduce((sum, amount) => sum + amount, 0n)).toBe(paid);
      result.value.forEach((settled, index) => expect(settled <= (owed[index] ?? 0n)).toBe(true));
      result.value.slice(0, -1).forEach((settled, index) => expect(settled).toBe(owed[index]));
    }));
  });
});

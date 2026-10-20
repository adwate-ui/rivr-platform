import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fromPaise } from '../money/index.ts';
import { withdrawalCheck } from './withdrawal.ts';

const paise = fc.bigInt({ min: -10_000n, max: 100_000_000n }).map(fromPaise);

describe('withdrawalCheck properties', () => {
  it('lets through exactly whole rupees above nothing, no more than the wallet holds', () => {
    fc.assert(fc.property(paise, paise, (amount, cash) => {
      expect(withdrawalCheck(amount, cash).ok).toBe(amount > 0n && amount % 100n === 0n && amount <= cash);
    }));
  });

  it('says paise before the wallet being short, whatever the wallet holds', () => {
    const withPaise = fc.bigInt({ min: 0n, max: 1_000_000n }).map((rupees) => fromPaise(rupees * 100n + 50n));
    fc.assert(fc.property(withPaise, paise, (amount, cash) => {
      expect(withdrawalCheck(amount, cash)).toEqual({ ok: false, error: 'not_rupees' });
    }));
  });
});

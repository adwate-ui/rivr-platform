import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fromPaise, isChipMultiple } from '../money/index.ts';
import { creditLimit } from './credit.ts';

const paise = fc.bigInt({ min: -10_000n, max: 100_000_000n }).map(fromPaise);

describe('creditLimit properties', () => {
  it('lets through only whole ₹50 chips, never below nothing', () => {
    fc.assert(fc.property(paise, paise, paise, (limit, threshold, current) => {
      expect(creditLimit(limit, threshold, current).ok).toBe(limit >= 0n && isChipMultiple(limit));
    }));
  });

  it('asks for approval only for a raise above the threshold', () => {
    fc.assert(fc.property(paise, paise, paise, (limit, threshold, current) => {
      const set = creditLimit(limit, threshold, current);
      if (set.ok) expect(set.value).toBe(limit > threshold && limit > current ? 'needs_approval' : 'active');
    }));
  });

  it('sets the same limit again, above the threshold, at once: nothing is raised', () => {
    expect(creditLimit(fromPaise(30_000_000n), fromPaise(10_000_000n), fromPaise(30_000_000n))).toEqual({ ok: true, value: 'active' });
    expect(creditLimit(fromPaise(30_000_000n), fromPaise(30_000_000n), fromPaise(0n))).toEqual({ ok: true, value: 'active' });
  });

  it('refuses a limit below nothing', () => {
    expect(creditLimit(fromPaise(-5_000n), fromPaise(10_000_000n), fromPaise(0n))).toEqual({ ok: false, error: 'not_chips' });
  });
});

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CHIP, fromPaise, fromRupees, isChipMultiple } from '../money/index.ts';
import { creditAvailable, isPastDue, markerCheck } from './markers.ts';

const chips = fc.bigInt({ min: 0n, max: 2_000_000n }).map((count) => fromPaise(count * 5_000n));
const anyPaise = fc.bigInt({ min: -1n, max: 100_000_000n }).map(fromPaise);

describe('markerCheck properties', () => {
  it('issues only whole chips that keep the member within their limit and the room within its cap, with nothing past due', () => {
    const terms = fc.record({ outstanding: chips, limit: chips, exposure: chips, cap: chips, isPastDue: fc.boolean() });
    fc.assert(fc.property(anyPaise, terms, (amount, given) => {
      if (markerCheck(amount, given).ok) {
        expect(amount > 0n && isChipMultiple(amount) && !given.isPastDue).toBe(true);
        expect(given.outstanding + amount <= given.limit && given.exposure + amount <= given.cap).toBe(true);
      }
    }));
  });

  it('refuses for a marker past due before anything about the amount it is for', () => {
    fc.assert(fc.property(chips, chips, chips, (amount, limit, cap) => {
      fc.pre(amount > 0n);
      const result = markerCheck(amount, { outstanding: fromPaise(0n), limit, exposure: fromPaise(0n), cap, isPastDue: true });
      expect(result).toEqual({ ok: false, error: 'past_due' });
    }));
  });
});

describe('creditAvailable', () => {
  const open = fc.array(chips.filter((amount) => amount > 0n), { maxLength: 4 });
  const owed = (markers: readonly bigint[]) => fromPaise(markers.reduce((total, amount) => total + amount, 0n));

  it('is the most one more marker can be, within the limit; a chip more is above it', () => {
    fc.assert(fc.property(chips, open, (limit, markers) => {
      const available = creditAvailable(limit, markers.map(fromPaise));
      const terms = { outstanding: owed(markers), limit, exposure: fromPaise(0n), cap: fromPaise(10_000_000_000n), isPastDue: false };
      expect(available >= 0n).toBe(true);
      if (available > 0n) expect(markerCheck(available, terms).ok).toBe(true);
      expect(markerCheck(fromPaise(available + CHIP), terms)).toEqual({ ok: false, error: 'above_limit' });
    }));
  });

  it('is the limit less what the open markers owe, and nothing once they owe it all or more', () => {
    expect(creditAvailable(fromRupees(200_000n), [fromRupees(50_000n)])).toBe(fromRupees(150_000n));
    expect(creditAvailable(fromRupees(200_000n), [fromRupees(50_000n), fromRupees(30_000n)])).toBe(fromRupees(120_000n));
    expect(creditAvailable(fromRupees(200_000n), [])).toBe(fromRupees(200_000n));
    expect(creditAvailable(fromRupees(50_000n), [fromRupees(50_000n)])).toBe(fromPaise(0n));
    expect(creditAvailable(fromRupees(20_000n), [fromRupees(50_000n)])).toBe(fromPaise(0n));
  });
});

describe('isPastDue', () => {
  it('is past due once the due time has gone by, and not at it or before', () => {
    const due = new Date('2026-11-05T12:00:00Z');
    expect(isPastDue(due, new Date('2026-11-05T12:00:00.001Z'))).toBe(true);
    expect(isPastDue(due, new Date('2026-11-05T12:00:00Z'))).toBe(false);
    expect(isPastDue(due, new Date('2026-10-20T12:00:00Z'))).toBe(false);
  });

  it('agrees with the order of the two moments', () => {
    fc.assert(fc.property(fc.date({ noInvalidDate: true }), fc.date({ noInvalidDate: true }), (due, at) => {
      expect(isPastDue(due, at)).toBe(due.getTime() < at.getTime());
    }));
  });
});
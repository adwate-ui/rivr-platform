import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fromPaise } from '../money/index.ts';
import { bonusAvailable, bonusExpired, bonusSpend, type BonusGrant } from './bonus.ts';

const AT = new Date('2026-11-15T20:00:00+05:30');
const chips = fc.bigInt({ min: 1n, max: 40_000n }).map((count) => fromPaise(count * 5_000n));
const grant = fc.record({
  remaining: fc.bigInt({ min: 0n, max: 2_000_000n }).map((paise) => fromPaise(paise)),
  // From a day before AT to a week after, so some grants have ended and some are in force; or no end (decision 0504).
  expiresAt: fc.option(fc.integer({ min: -86_400, max: 604_800 }).map((seconds) => new Date(AT.getTime() + seconds * 1000)), { nil: null }),
});
const grants = fc.array(grant, { maxLength: 6 });

/** Whether a grant had ended by AT: one with no end never has. */
const hasEnded = (from: BonusGrant) => from.expiresAt !== null && from.expiresAt <= AT;

/** Whether `earlier` ends before `later`: a dated end comes before none. */
const endsBefore = (earlier: BonusGrant, later: BonusGrant) =>
  earlier.expiresAt !== null && (later.expiresAt === null || earlier.expiresAt < later.expiresAt);

describe('bonus properties', () => {
  it('spends exactly the amount, from grants in force only, never more than any grant has left', () => {
    fc.assert(fc.property(chips, grants, (amount, held) => {
      const spent = bonusSpend(amount, held, AT);
      if (!spent.ok) {
        expect(spent.error === 'bonus_short' && amount > bonusAvailable(held, AT)).toBe(true);
        return;
      }
      expect(spent.value.reduce((sum, taken) => sum + taken, 0n)).toBe(amount);
      spent.value.forEach((taken, index) => {
        const from: BonusGrant | undefined = held[index];
        expect(taken <= (from?.remaining ?? 0n)).toBe(true);
        if (from !== undefined && hasEnded(from)) expect(taken).toBe(0n);
      });
    }));
  });

  it('draws a later-ending grant, or one with no end, only once every earlier-ending one is used up', () => {
    fc.assert(fc.property(chips, grants, (amount, held) => {
      const spent = bonusSpend(amount, held, AT);
      if (!spent.ok) return;
      held.forEach((later, laterIndex) => {
        if ((spent.value[laterIndex] ?? 0n) === 0n) return;
        held.forEach((earlier, earlierIndex) => {
          if (!hasEnded(earlier) && endsBefore(earlier, later)) expect(spent.value[earlierIndex]).toBe(earlier.remaining);
        });
      });
    }));
  });

  it('draws grants with no end the oldest (listed first) first', () => {
    fc.assert(fc.property(chips, grants, (amount, held) => {
      const spent = bonusSpend(amount, held, AT);
      if (!spent.ok) return;
      held.forEach((later, laterIndex) => {
        if (later.expiresAt !== null || (spent.value[laterIndex] ?? 0n) === 0n) return;
        held.slice(0, laterIndex).forEach((earlier, earlierIndex) => {
          if (earlier.expiresAt === null) expect(spent.value[earlierIndex]).toBe(earlier.remaining);
        });
      });
    }));
  });

  it('expires every remainder whose end has come, and nothing in force or with no end', () => {
    fc.assert(fc.property(grants, (held) => {
      const expired = bonusExpired(held, AT);
      held.forEach((from, index) => expect(expired[index]).toBe(hasEnded(from) ? from.remaining : 0n));
      expect(bonusAvailable(held, AT) + expired.reduce((sum, gone) => sum + gone, 0n)).toBe(held.reduce((sum, from) => sum + from.remaining, 0n));
    }));
  });
});

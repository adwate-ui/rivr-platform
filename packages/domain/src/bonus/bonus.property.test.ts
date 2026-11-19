import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fromPaise, isChipMultiple } from '../money/index.ts';
import { bonusAvailable, bonusEnd, bonusExpired, bonusPayOff, bonusSpend, bonusTake, visitBonusCap, visitBonusLeft, type BonusGrant } from './bonus.ts';

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

  // Decision 0579: rolling expiry, the oldest spent first.
  it('ends a grant after it was given and after expiry was switched on, or never with expiry off', () => {
    const moment = fc.integer({ min: 0, max: 400 * 86_400 }).map((seconds) => new Date(AT.getTime() + seconds * 1000));
    fc.assert(fc.property(moment, moment, fc.integer({ min: 0, max: 3650 }), (given, since, days) => {
      const ends = bonusEnd(given, days, since);
      if (days === 0) {
        expect(ends).toBeNull();
        return;
      }
      expect(ends !== null && ends > given && ends > since).toBe(true);
    }));
  });

  it('spends the oldest grant first when every grant ends the same days after it was given', () => {
    const since = new Date(AT.getTime() - 400 * 86_400_000);
    const given = fc.array(fc.record({ remaining: fc.bigInt({ min: 0n, max: 2_000_000n }).map(fromPaise), daysAgo: fc.integer({ min: 0, max: 29 }) }), { maxLength: 6 })
      .map((list) => [...list].sort((a, b) => b.daysAgo - a.daysAgo));
    fc.assert(fc.property(chips, given, (amount, list) => {
      const held = list.map(({ remaining, daysAgo }) => ({ remaining, expiresAt: bonusEnd(new Date(AT.getTime() - daysAgo * 86_400_000), 30, since) }));
      const spent = bonusSpend(amount, held, AT);
      if (!spent.ok) return;
      // Listed oldest first: a grant is drawn on only once every older one is used up.
      held.forEach((_later, laterIndex) => {
        if ((spent.value[laterIndex] ?? 0n) === 0n) return;
        held.slice(0, laterIndex).forEach((earlier, earlierIndex) => {
          if ((list[earlierIndex]?.daysAgo ?? 0) > (list[laterIndex]?.daysAgo ?? 0)) expect(spent.value[earlierIndex]).toBe(earlier.remaining);
        });
      });
    }));
  });

  it('caps a visit at no more than was held, in whole ₹50 chips, more for a higher share, and leaves nothing below nothing', () => {
    const held = fc.bigInt({ min: 0n, max: 100_000_000n }).map(fromPaise);
    const share = fc.bigInt({ min: 0n, max: 10_000n });
    fc.assert(fc.property(held, share, share, fc.bigInt({ min: 0n, max: 100_000_000n }).map(fromPaise), (balance, lower, higher, redeemed) => {
      const [low, high] = lower <= higher ? [lower, higher] : [higher, lower];
      const cap = visitBonusCap(balance, high);
      expect(cap <= balance && isChipMultiple(cap) && visitBonusCap(balance, low) <= cap).toBe(true);
      const left = visitBonusLeft(cap, redeemed);
      expect(left >= 0n && left <= cap && (redeemed <= cap ? left === cap - redeemed : left === 0n)).toBe(true);
    }));
  });

  it('takes back exactly the amount, between the grants and what is owed, never more than a grant has left', () => {
    const paise = fc.bigInt({ min: 0n, max: 5_000_000n }).map(fromPaise);
    fc.assert(fc.property(paise, grants, fc.nat(), fc.boolean(), (amount, held, pick, isReversal) => {
      const first = isReversal && held.length > 0 ? pick % held.length : null;
      const { taken, owed } = bonusTake(amount, held, AT, first);
      expect(taken.reduce((sum, part) => sum + part, 0n) + owed).toBe(amount);
      expect(owed >= 0n).toBe(true);
      taken.forEach((part, index) => {
        const from: BonusGrant | undefined = held[index];
        expect(part >= 0n && part <= (from?.remaining ?? 0n)).toBe(true);
        // Of the ended grants, only the one reversed gives.
        if (from !== undefined && index !== first && hasEnded(from)) expect(part).toBe(0n);
      });
    }));
  });

  it('owes only once every grant it may draw on is used up, the one reversed first of all', () => {
    const paise = fc.bigInt({ min: 0n, max: 5_000_000n }).map(fromPaise);
    fc.assert(fc.property(paise, grants, fc.nat(), (amount, held, pick) => {
      const first = held.length > 0 ? pick % held.length : null;
      const { taken, owed } = bonusTake(amount, held, AT, first);
      const drawable = held.map((from, index) => index === first || !hasEnded(from));
      if (owed > 0n) held.forEach((from, index) => { if (drawable[index] === true) expect(taken[index]).toBe(from.remaining); });
      const othersGave = taken.some((part, index) => index !== first && part > 0n);
      if (first !== null && othersGave) expect(taken[first]).toBe(held[first]?.remaining);
    }));
  });

  it('throws on Bonus taken back below nothing, or from a grant not in the list: a bug in the caller', () => {
    const held: BonusGrant[] = [{ remaining: fromPaise(1_000n), expiresAt: null }];
    expect(() => bonusTake(fromPaise(-1n), held, AT, null)).toThrow(RangeError);
    expect(() => bonusTake(fromPaise(0n), held, AT, 1)).toThrow(RangeError);
    expect(() => bonusTake(fromPaise(0n), held, AT, -1)).toThrow(RangeError);
    expect(bonusTake(fromPaise(0n), held, AT, 0)).toEqual({ taken: [0n], owed: 0n });
  });

  it('pays what is owed first and keeps the rest, never below nothing', () => {
    const paise = fc.bigInt({ min: 0n, max: 10_000_000n }).map(fromPaise);
    fc.assert(fc.property(paise, paise, (given, owed) => {
      const { paid, kept } = bonusPayOff(given, owed);
      expect(paid + kept).toBe(given);
      expect(paid >= 0n && kept >= 0n && paid <= owed).toBe(true);
      expect(kept === 0n || paid === owed).toBe(true);
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

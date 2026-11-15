import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden } from '@rivr/testing';
import minBuyInJson from '@rivr/testing/golden/tableMinBuyIn.json';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fromPaise, type Paise } from '../money/index.ts';
import { parseRupees } from '../money/parse-rupees.ts';
import { isMinBuyIn, suggestedMinBuyIn, SUGGESTED_MIN_BUY_IN_BIG_BLINDS } from './index.ts';

const golden = readGolden(minBuyInJson);

/** Reads a fixture amount such as "₹5,00,000". The fixture is wrong if it does not parse. */
function amount(text: string): Paise {
  const parsed = parseRupees(text);
  if (!parsed.ok) throw new Error(`Golden amount "${text}" does not parse: ${parsed.error}`);
  return parsed.value;
}

describe('Table minimum buy-in golden fixtures (packages/testing/golden/tableMinBuyIn.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['suggest', 'allowed'])).not.toThrow();
  });

  it.each(casesFor(golden, 'suggest'))('%s', (_description, goldenCase) => {
    expect(suggestedMinBuyIn(amount(goldenInput(goldenCase, 'bigBlind')))).toBe(amount(goldenExpected(goldenCase, 'minBuyIn')));
  });

  it.each(casesFor(golden, 'allowed'))('%s', (_description, goldenCase) => {
    expect(isMinBuyIn(amount(goldenInput(goldenCase, 'amount')))).toBe(goldenExpected(goldenCase, 'allowed') === 'yes');
  });
});

describe('the suggested minimum buy-in', () => {
  // Blinds as the database keeps them: whole 50s, in paise.
  const bigBlind = fc.bigInt({ min: 2n, max: 2_000n }).map((fifties) => fromPaise(fifties * 5_000n));

  it('is 50 big blinds', () => {
    expect(SUGGESTED_MIN_BUY_IN_BIG_BLINDS).toBe(50n);
  });

  it('is exactly 50 of the big blind, in whole 50s, and always an amount a table may keep', () => {
    fc.assert(fc.property(bigBlind, (blind) => {
      const suggested = suggestedMinBuyIn(blind);
      expect(suggested / blind).toBe(50n);
      expect(suggested % blind).toBe(0n);
      expect(suggested % 5_000n).toBe(0n);
      expect(isMinBuyIn(suggested)).toBe(true);
    }));
  });

  it('grows with the big blind', () => {
    fc.assert(fc.property(bigBlind, bigBlind, (one, other) => {
      expect(suggestedMinBuyIn(one) < suggestedMinBuyIn(other)).toBe(one < other);
    }));
  });

  it('takes whole 50s above zero and nothing else', () => {
    expect([0n, 1n, 4_999n, 5_001n, 734_900n, -5_000n].map((paise) => isMinBuyIn(fromPaise(paise)))).toEqual([false, false, false, false, false, false]);
    expect([5_000n, 10_000n, 735_000n].map((paise) => isMinBuyIn(fromPaise(paise)))).toEqual([true, true, true]);
  });

  it('takes an amount exactly when it is a positive count of ₹50', () => {
    fc.assert(fc.property(fc.bigInt({ min: -1_000_000n, max: 1_000_000_000n }), (paise) => {
      expect(isMinBuyIn(fromPaise(paise))).toBe(paise > 0n && paise % 5_000n === 0n);
    }));
  });
});

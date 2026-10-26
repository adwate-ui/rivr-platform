import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden } from '@rivr/testing';
import tdsReturnJson from '@rivr/testing/golden/tdsReturn.json';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { add, fromPaise, type Paise } from '../money/index.ts';
import { parseRupees } from '../money/parse-rupees.ts';
import { tdsTaxedWinnings } from './taxedWinnings.ts';

const golden = readGolden(tdsReturnJson);

/** Reads a fixture amount such as "₹40,000.50". The fixture is wrong if it does not parse. */
function amount(text: string): Paise {
  const parsed = parseRupees(text);
  if (!parsed.ok) throw new Error(`Golden amount "${text}" does not parse: ${parsed.error}`);
  return parsed.value;
}

describe('the winnings a TDS deduction was taxed on (packages/testing/golden/tdsReturn.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['taxed'])).not.toThrow();
  });

  it.each(casesFor(golden, 'taxed'))('%s', (_description, goldenCase) => {
    const taxed = tdsTaxedWinnings(amount(goldenInput(goldenCase, 'winnings')), amount(goldenInput(goldenCase, 'taxedBefore')));
    expect(taxed).toBe(amount(goldenExpected(goldenCase, 'taxed')));
  });

  it('never gives less than nothing, nor more than the period has won', () => {
    const paise = fc.bigInt({ min: 0n, max: 10_000_000_000n });
    fc.assert(fc.property(paise, paise, (winnings, before) => {
      const taxed = tdsTaxedWinnings(fromPaise(winnings), fromPaise(before));
      expect(taxed >= 0n && taxed <= winnings).toBe(true);
    }));
  });

  it('adds up, over a period whose winnings only rise, to what the period won', () => {
    fc.assert(fc.property(fc.array(fc.bigInt({ min: 0n, max: 1_000_000n }), { minLength: 1, maxLength: 8 }), (steps) => {
      let won = fromPaise(0n);
      let taxed = fromPaise(0n);
      for (const step of steps) {
        const before = won;
        won = add(won, fromPaise(step));
        taxed = add(taxed, tdsTaxedWinnings(won, before));
      }
      expect(taxed).toBe(won);
    }));
  });
});

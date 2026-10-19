import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden } from '@rivr/testing';
import cashOutJson from '@rivr/testing/golden/cashOut.json';
import { describe, expect, it } from 'vitest';
import { fromPaise, type Paise } from '../money/index.ts';
import { parseRupees } from '../money/parse-rupees.ts';
import { cashOut } from './cashOut.ts';

const golden = readGolden(cashOutJson);

/** Reads a fixture amount such as "₹50,000"; "₹0" is nothing. The fixture is wrong if it does not parse. */
function amount(text: string): Paise {
  if (text === '₹0') return fromPaise(0n);
  const parsed = parseRupees(text);
  if (!parsed.ok) throw new Error(`Golden amount "${text}" does not parse: ${parsed.error}`);
  return parsed.value;
}

/** Reads a fixture list such as "₹50,000 | ₹20,000"; empty is none. */
function amounts(text: string): Paise[] {
  return text === '' ? [] : text.split(' | ').map(amount);
}

describe('Cash-out golden fixtures (packages/testing/golden/cashOut.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['cash_out'])).not.toThrow();
  });

  it.each(casesFor(golden, 'cash_out'))('%s', (_description, goldenCase) => {
    const result = cashOut(amount(goldenInput(goldenCase, 'chips')), amounts(goldenInput(goldenCase, 'markers')));
    if (!result.ok) {
      expect(goldenExpected(goldenCase, 'toMember')).toBe(result.error);
      return;
    }
    expect(result.value).toEqual({ settled: amounts(goldenExpected(goldenCase, 'settled')), toMember: amount(goldenExpected(goldenCase, 'toMember')) });
  });
});

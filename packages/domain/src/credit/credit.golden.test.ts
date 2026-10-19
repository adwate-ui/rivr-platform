import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden } from '@rivr/testing';
import creditJson from '@rivr/testing/golden/credit.json';
import { describe, expect, it } from 'vitest';
import { fromPaise, type Paise } from '../money/index.ts';
import { parseRupees } from '../money/parse-rupees.ts';
import { creditLimit } from './credit.ts';

const golden = readGolden(creditJson);

/** Reads a fixture amount such as "₹50,000"; "₹0" is nothing. The fixture is wrong if it does not parse. */
function amount(text: string): Paise {
  if (text === '₹0') return fromPaise(0n);
  const parsed = parseRupees(text);
  if (!parsed.ok) throw new Error(`Golden amount "${text}" does not parse: ${parsed.error}`);
  return parsed.value;
}

describe('Credit limit golden fixtures (packages/testing/golden/credit.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['limit'])).not.toThrow();
  });

  it.each(casesFor(golden, 'limit'))('%s', (_description, goldenCase) => {
    const result = creditLimit(amount(goldenInput(goldenCase, 'limit')), amount(goldenInput(goldenCase, 'threshold')),
      amount(goldenInput(goldenCase, 'current')));
    expect(result.ok ? result.value : result.error).toBe(goldenExpected(goldenCase, 'result'));
  });
});

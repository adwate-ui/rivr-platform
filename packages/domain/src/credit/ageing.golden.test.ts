import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden } from '@rivr/testing';
import creditAgeingJson from '@rivr/testing/golden/creditAgeing.json';
import { describe, expect, it } from 'vitest';
import { repayment } from '../cage/repayment.ts';
import { fromPaise, type Paise } from '../money/index.ts';
import { parseRupees } from '../money/parse-rupees.ts';
import { ageingBucket } from './ageing.ts';

const golden = readGolden(creditAgeingJson);

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

describe('Credit ageing golden fixtures (packages/testing/golden/creditAgeing.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['bucket', 'repay'])).not.toThrow();
  });

  it.each(casesFor(golden, 'bucket'))('%s', (_description, goldenCase) => {
    expect(ageingBucket(new Date(goldenInput(goldenCase, 'issued')), new Date(goldenInput(goldenCase, 'at')))).toBe(goldenExpected(goldenCase, 'bucket'));
  });

  it.each(casesFor(golden, 'repay'))('%s', (_description, goldenCase) => {
    const result = repayment(amount(goldenInput(goldenCase, 'amount')), amounts(goldenInput(goldenCase, 'markers')));
    const expected = goldenExpected(goldenCase, 'settled');
    if (!result.ok) expect(result.error).toBe(expected);
    else expect(result.value).toEqual(amounts(expected));
  });
});

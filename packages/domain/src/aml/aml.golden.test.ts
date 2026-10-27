import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden } from '@rivr/testing';
import amlJson from '@rivr/testing/golden/aml.json';
import { describe, expect, it } from 'vitest';
import type { Paise } from '../money/index.ts';
import { parseRupees } from '../money/parse-rupees.ts';
import { cashLimitHit, isNearLimit } from './aml.ts';

const golden = readGolden(amlJson);

/** Reads a fixture amount such as "₹40,000". The fixture is wrong if it does not parse. */
function amount(text: string): Paise {
  const parsed = parseRupees(text);
  if (!parsed.ok) throw new Error(`Golden amount "${text}" does not parse: ${parsed.error}`);
  return parsed.value;
}

describe('AML golden fixtures (packages/testing/golden/aml.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['cash_limit', 'near_limit'])).not.toThrow();
  });

  it.each(casesFor(golden, 'cash_limit'))('%s', (_description, goldenCase) => {
    const limits = { perVisit: amount(goldenInput(goldenCase, 'perVisit')), perDay: amount(goldenInput(goldenCase, 'perDay')) };
    const hit = cashLimitHit(limits, amount(goldenInput(goldenCase, 'visitSoFar')), amount(goldenInput(goldenCase, 'daySoFar')),
      amount(goldenInput(goldenCase, 'amount')));
    expect(hit ?? 'none').toBe(goldenExpected(goldenCase, 'hit'));
  });

  it.each(casesFor(golden, 'near_limit'))('%s', (_description, goldenCase) => {
    const near = isNearLimit(amount(goldenInput(goldenCase, 'total')), amount(goldenInput(goldenCase, 'limit')),
      Number(goldenInput(goldenCase, 'marginBasisPoints')));
    expect(String(near)).toBe(goldenExpected(goldenCase, 'near'));
  });
});

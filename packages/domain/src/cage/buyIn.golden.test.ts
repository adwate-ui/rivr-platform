import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden, type GoldenCase } from '@rivr/testing';
import cageJson from '@rivr/testing/golden/cage.json';
import { describe, expect, it } from 'vitest';
import type { Paise } from '../money/index.ts';
import { parseRupees } from '../money/parse-rupees.ts';
import { buyIn, type BuyInMethod } from './buyIn.ts';

const golden = readGolden(cageJson);

/** Reads a fixture amount such as "₹10,000". The fixture is wrong if it does not parse. */
function amount(text: string): Paise {
  const parsed = parseRupees(text);
  if (!parsed.ok) throw new Error(`Golden amount "${text}" does not parse: ${parsed.error}`);
  return parsed.value;
}

function methodOf(goldenCase: GoldenCase): BuyInMethod {
  const method = goldenInput(goldenCase, 'method');
  if (method !== 'cash' && method !== 'upi' && method !== 'wallet') throw new Error(`Golden method "${method}" is not cash, upi or wallet`);
  return method;
}

describe('Cage buy-in golden fixtures (packages/testing/golden/cage.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['buy_in'])).not.toThrow();
  });

  it.each(casesFor(golden, 'buy_in'))('%s', (_description, goldenCase) => {
    const result = buyIn(methodOf(goldenCase), amount(goldenInput(goldenCase, 'amount')), amount(goldenInput(goldenCase, 'minimum')),
      amount(goldenInput(goldenCase, 'wallet')));
    const expected = goldenExpected(goldenCase, 'result');
    expect(result).toEqual(expected === 'ok' ? { ok: true, value: goldenExpected(goldenCase, 'debit') } : { ok: false, error: expected });
  });
});

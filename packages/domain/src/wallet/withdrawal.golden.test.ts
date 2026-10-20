import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden } from '@rivr/testing';
import walletJson from '@rivr/testing/golden/wallet.json';
import { describe, expect, it } from 'vitest';
import type { Paise } from '../money/index.ts';
import { parseRupees } from '../money/parse-rupees.ts';
import { withdrawalCheck } from './withdrawal.ts';

const golden = readGolden(walletJson);

/** Reads a fixture amount such as "₹1,00,000". The fixture is wrong if it does not parse. */
function amount(text: string): Paise {
  const parsed = parseRupees(text);
  if (!parsed.ok) throw new Error(`Golden amount "${text}" does not parse: ${parsed.error}`);
  return parsed.value;
}

describe('Withdrawal golden fixtures (packages/testing/golden/wallet.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['withdraw'])).not.toThrow();
  });

  it.each(casesFor(golden, 'withdraw'))('%s', (_description, goldenCase) => {
    const result = withdrawalCheck(amount(goldenInput(goldenCase, 'amount')), amount(goldenInput(goldenCase, 'cash')));
    expect(result.ok ? 'ok' : result.error).toBe(goldenExpected(goldenCase, 'result'));
  });
});

import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden } from '@rivr/testing';
import tdsJson from '@rivr/testing/golden/tds.json';
import { describe, expect, it } from 'vitest';
import { negate, type Paise } from '../money/index.ts';
import { parseRupees } from '../money/parse-rupees.ts';
import { tdsOnCashOut } from './tds.ts';

const golden = readGolden(tdsJson);

/** Reads a fixture amount such as "₹40,000" or "-₹20,000". The fixture is wrong if it does not parse. */
function amount(text: string): Paise {
  const isNegative = text.startsWith('-');
  const parsed = parseRupees(isNegative ? text.slice(1) : text);
  if (!parsed.ok) throw new Error(`Golden amount "${text}" does not parse: ${parsed.error}`);
  return isNegative ? negate(parsed.value) : parsed.value;
}

describe('TDS golden fixtures (packages/testing/golden/tds.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['tds'])).not.toThrow();
  });

  it.each(casesFor(golden, 'tds'))('%s', (_description, goldenCase) => {
    const input = (name: string) => goldenInput(goldenCase, name);
    const result = tdsOnCashOut(
      { winnings: amount(input('winnings')), already: amount(input('already')), payout: amount(input('payout')), hasPan: input('hasPan') === 'yes' },
      { rate: BigInt(input('rate')), threshold: amount(input('threshold')), panRequired: input('panRequired') === 'yes', noPanRate: BigInt(input('noPanRate')) },
    );
    expect(result).toEqual({
      rate: BigInt(goldenExpected(goldenCase, 'rate')), due: amount(goldenExpected(goldenCase, 'due')), amount: amount(goldenExpected(goldenCase, 'amount')),
    });
  });
});

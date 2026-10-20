import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden } from '@rivr/testing';
import eodJson from '@rivr/testing/golden/eod.json';
import { describe, expect, it } from 'vitest';
import { negate, type Paise } from '../money/index.ts';
import { parseRupees } from '../money/parse-rupees.ts';
import { shiftClose } from './eod.ts';

const golden = readGolden(eodJson);

/** Reads a fixture amount such as "₹12,48,000" or "-₹500". The fixture is wrong if it does not parse. */
function amount(text: string): Paise {
  const isShort = text.startsWith('-');
  const parsed = parseRupees(isShort ? text.slice(1) : text);
  if (!parsed.ok) throw new Error(`Golden amount "${text}" does not parse: ${parsed.error}`);
  return isShort ? negate(parsed.value) : parsed.value;
}

describe('Shift close golden fixtures (packages/testing/golden/eod.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['close'])).not.toThrow();
  });

  it.each(casesFor(golden, 'close'))('%s', (_description, goldenCase) => {
    const figures = (side: 'counted' | 'expected') => ({
      cash: amount(goldenInput(goldenCase, `${side}Cash`)),
      chips: amount(goldenInput(goldenCase, `${side}Chips`)),
      receipts: amount(goldenInput(goldenCase, `${side}Receipts`)),
      markers: amount(goldenInput(goldenCase, `${side}Markers`)),
    });
    expect(shiftClose(figures('counted'), figures('expected'))).toEqual({
      variance: {
        cash: amount(goldenExpected(goldenCase, 'cash')),
        chips: amount(goldenExpected(goldenCase, 'chips')),
        receipts: amount(goldenExpected(goldenCase, 'receipts')),
        markers: amount(goldenExpected(goldenCase, 'markers')),
      },
      isAnomaly: goldenExpected(goldenCase, 'anomaly') === 'yes',
    });
  });
});

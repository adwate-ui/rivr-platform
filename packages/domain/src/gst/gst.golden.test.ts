import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden } from '@rivr/testing';
import gstJson from '@rivr/testing/golden/gst.json';
import { describe, expect, it } from 'vitest';
import type { Paise } from '../money/index.ts';
import { parseRupees } from '../money/parse-rupees.ts';
import { gstIncluded } from './gst.ts';

const golden = readGolden(gstJson);

/** Reads a fixture amount such as "₹1,694.92". The fixture is wrong if it does not parse. */
function amount(text: string): Paise {
  const parsed = parseRupees(text);
  if (!parsed.ok) throw new Error(`Golden amount "${text}" does not parse: ${parsed.error}`);
  return parsed.value;
}

describe('GST golden fixtures (packages/testing/golden/gst.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['gst_included'])).not.toThrow();
  });

  it.each(casesFor(golden, 'gst_included'))('%s', (_description, goldenCase) => {
    const split = gstIncluded(amount(goldenInput(goldenCase, 'inclusive')), BigInt(goldenInput(goldenCase, 'rate')));
    const expected = (name: string) => amount(goldenExpected(goldenCase, name));
    expect(split).toEqual({ taxable: expected('taxable'), cgst: expected('cgst'), sgst: expected('sgst') });
  });
});

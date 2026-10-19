import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden } from '@rivr/testing';
import markersJson from '@rivr/testing/golden/markers.json';
import { describe, expect, it } from 'vitest';
import { fromPaise, type Paise } from '../money/index.ts';
import { parseRupees } from '../money/parse-rupees.ts';
import { markerCheck } from './markers.ts';

const golden = readGolden(markersJson);

/** Reads a fixture amount such as "₹50,000"; "₹0" is nothing. The fixture is wrong if it does not parse. */
function amount(text: string): Paise {
  if (text === '₹0') return fromPaise(0n);
  const parsed = parseRupees(text);
  if (!parsed.ok) throw new Error(`Golden amount "${text}" does not parse: ${parsed.error}`);
  return parsed.value;
}

describe('Marker golden fixtures (packages/testing/golden/markers.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['issue'])).not.toThrow();
  });

  it.each(casesFor(golden, 'issue'))('%s', (_description, goldenCase) => {
    const result = markerCheck(amount(goldenInput(goldenCase, 'amount')), {
      outstanding: amount(goldenInput(goldenCase, 'outstanding')), limit: amount(goldenInput(goldenCase, 'limit')),
      exposure: amount(goldenInput(goldenCase, 'exposure')), cap: amount(goldenInput(goldenCase, 'cap')),
      isPastDue: goldenInput(goldenCase, 'pastDue') === 'yes',
    });
    expect(result.ok ? 'ok' : result.error).toBe(goldenExpected(goldenCase, 'result'));
  });
});

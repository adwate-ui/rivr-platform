import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden } from '@rivr/testing';
import varianceJson from '@rivr/testing/golden/variance.json';
import { describe, expect, it } from 'vitest';
import { negate, type Paise } from '../money/index.ts';
import { parseRupees } from '../money/parse-rupees.ts';
import { downVariance } from './variance.ts';

const golden = readGolden(varianceJson);

/** Reads a fixture amount such as "₹2,300" or "-₹200". The fixture is wrong if it does not parse. */
function amount(text: string): Paise {
  const isShort = text.startsWith('-');
  const parsed = parseRupees(isShort ? text.slice(1) : text);
  if (!parsed.ok) throw new Error(`Golden amount "${text}" does not parse: ${parsed.error}`);
  return isShort ? negate(parsed.value) : parsed.value;
}

describe('Down variance golden fixtures (packages/testing/golden/variance.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['variance'])).not.toThrow();
  });

  it.each(casesFor(golden, 'variance'))('%s', (_description, goldenCase) => {
    const threshold = goldenInput(goldenCase, 'threshold');
    const result = downVariance(amount(goldenInput(goldenCase, 'dropBox')), amount(goldenInput(goldenCase, 'logged')),
      threshold === '' ? null : amount(threshold));
    expect(result).toEqual({ variance: amount(goldenExpected(goldenCase, 'variance')), isAlert: goldenExpected(goldenCase, 'alert') === 'yes' });
  });
});

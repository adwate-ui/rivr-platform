import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden } from '@rivr/testing';
import glazaJson from '@rivr/testing/golden/glaza.json';
import { describe, expect, it } from 'vitest';
import { fromPaise, type Paise } from '../money/index.ts';
import { parseRupees } from '../money/parse-rupees.ts';
import { glazaPayable } from './payable.ts';

const golden = readGolden(glazaJson);

/** Reads a fixture amount such as "₹499.99" or "-₹400". The fixture is wrong if it does not parse. */
function amount(text: string): Paise {
  const isBelowNothing = text.startsWith('-');
  const parsed = parseRupees(isBelowNothing ? text.slice(1) : text);
  if (!parsed.ok) throw new Error(`Golden amount "${text}" does not parse: ${parsed.error}`);
  return isBelowNothing ? fromPaise(-parsed.value) : parsed.value;
}

describe('Glaza statement golden fixtures (packages/testing/golden/glaza.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['payable'])).not.toThrow();
  });

  it.each(casesFor(golden, 'payable'))('%s', (_description, goldenCase) => {
    const result = glazaPayable(amount(goldenInput(goldenCase, 'comps')), amount(goldenInput(goldenCase, 'alcoholMargin')));
    expect(result).toEqual({ rivrShare: amount(goldenExpected(goldenCase, 'rivrShare')), payable: amount(goldenExpected(goldenCase, 'payable')) });
  });
});

describe('glazaPayable', () => {
  it('refuses comps below nothing', () => {
    expect(() => glazaPayable(fromPaise(-1n), fromPaise(0n))).toThrow(new RangeError('Comps at cost are never negative'));
  });
});

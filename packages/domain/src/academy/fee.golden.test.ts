import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden, type GoldenCase } from '@rivr/testing';
import academyJson from '@rivr/testing/golden/academy.json';
import { describe, expect, it } from 'vitest';
import { fromPaise, type Paise } from '../money/index.ts';
import { parseRupees } from '../money/parse-rupees.ts';
import { academyFee } from './fee.ts';

const golden = readGolden(academyJson);

/** Reads a fixture amount such as "₹1,999.99". The fixture is wrong if it does not parse. */
function amount(text: string): Paise {
  const parsed = parseRupees(text);
  if (!parsed.ok) throw new Error(`Golden amount "${text}" does not parse: ${parsed.error}`);
  return parsed.value;
}

function kindOf(goldenCase: GoldenCase): 'individual' | 'corporate' {
  const kind = goldenInput(goldenCase, 'kind');
  if (kind !== 'individual' && kind !== 'corporate') throw new Error(`Golden kind "${kind}" is neither individual nor corporate`);
  return kind;
}

describe('Academy fee golden fixtures (packages/testing/golden/academy.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['fee'])).not.toThrow();
  });

  it.each(casesFor(golden, 'fee'))('%s', (_description, goldenCase) => {
    const prices = { individual: amount(goldenInput(goldenCase, 'individual')), corporatePerHead: amount(goldenInput(goldenCase, 'corporatePerHead')) };
    const fee = academyFee(kindOf(goldenCase), BigInt(goldenInput(goldenCase, 'seats')), prices);
    expect(fee).toBe(amount(goldenExpected(goldenCase, 'result')));
  });
});

describe('academyFee', () => {
  it('refuses an individual booking of more than one seat, or a booking of none', () => {
    const prices = { individual: fromPaise(200_000n), corporatePerHead: fromPaise(150_000n) };
    const why = new RangeError('An individual booking is one seat; a corporate booking is one or more heads');
    expect(() => academyFee('individual', 2n, prices)).toThrow(why);
    expect(() => academyFee('corporate', 0n, prices)).toThrow(why);
  });
});

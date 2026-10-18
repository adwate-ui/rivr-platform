import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden, type GoldenCase } from '@rivr/testing';
import moneyJson from '@rivr/testing/golden/money.json';
import { describe, expect, it } from 'vitest';
import { add, subtract, times } from './arithmetic.ts';
import { isChipMultiple, roundDownToChip } from './chips.ts';
import type { Paise } from './paise.ts';
import { parseRupees } from './parse-rupees.ts';
import { shareOf } from './share.ts';

const golden = readGolden(moneyJson);

/** Reads a fixture amount such as "₹2,449.50". The fixture is wrong if it does not parse. */
function amount(text: string): Paise {
  const parsed = parseRupees(text);
  if (!parsed.ok) throw new Error(`Golden amount "${text}" does not parse: ${parsed.error}`);
  return parsed.value;
}

const input = (goldenCase: GoldenCase, name: string) => amount(goldenInput(goldenCase, name));
const expected = (goldenCase: GoldenCase) => goldenExpected(goldenCase, 'result');

describe('money golden fixtures (packages/testing/golden/money.json)', () => {
  it('tests every operation in the file', () => {
    expect(() =>
      assertOperations(golden, ['share', 'roundDownToChip', 'isChipMultiple', 'add', 'subtract', 'times']),
    ).not.toThrow();
  });

  it.each(casesFor(golden, 'share'))('%s', (_description, goldenCase) => {
    const basisPoints = BigInt(goldenInput(goldenCase, 'basisPoints'));
    expect(shareOf(input(goldenCase, 'amount'), basisPoints)).toBe(amount(expected(goldenCase)));
  });

  it.each(casesFor(golden, 'roundDownToChip'))('%s', (_description, goldenCase) => {
    expect(roundDownToChip(input(goldenCase, 'amount'))).toBe(amount(expected(goldenCase)));
  });

  it.each(casesFor(golden, 'isChipMultiple'))('%s', (_description, goldenCase) => {
    expect(isChipMultiple(input(goldenCase, 'amount')) ? 'yes' : 'no').toBe(expected(goldenCase));
  });

  it.each(casesFor(golden, 'add'))('%s', (_description, goldenCase) => {
    expect(add(input(goldenCase, 'first'), input(goldenCase, 'second'))).toBe(amount(expected(goldenCase)));
  });

  it.each(casesFor(golden, 'subtract'))('%s', (_description, goldenCase) => {
    expect(subtract(input(goldenCase, 'from'), input(goldenCase, 'amount'))).toBe(amount(expected(goldenCase)));
  });

  it.each(casesFor(golden, 'times'))('%s', (_description, goldenCase) => {
    const count = BigInt(goldenInput(goldenCase, 'count'));
    expect(times(input(goldenCase, 'amount'), count)).toBe(amount(expected(goldenCase)));
  });
});

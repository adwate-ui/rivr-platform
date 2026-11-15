import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden, type GoldenCase } from '@rivr/testing';
import sharesJson from '@rivr/testing/golden/shares.json';
import { describe, expect, it } from 'vitest';
import type { Paise } from '../money/index.ts';
import { parseRupees } from '../money/parse-rupees.ts';
import { rakeShare, tablePlayedSeconds } from './shares.ts';

const golden = readGolden(sharesJson);

/** Reads a fixture amount such as "₹612.40". The fixture is wrong if it does not parse. */
function amount(text: string): Paise {
  const parsed = parseRupees(text);
  if (!parsed.ok) throw new Error(`Golden amount "${text}" does not parse: ${parsed.error}`);
  return parsed.value;
}

const whole = (goldenCase: GoldenCase, name: string) => BigInt(goldenInput(goldenCase, name));

describe('shares golden fixtures (packages/testing/golden/shares.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['table_time', 'rake_share'])).not.toThrow();
  });

  it.each(casesFor(golden, 'table_time'))('%s', (_description, goldenCase) => {
    const seconds = tablePlayedSeconds(whole(goldenCase, 'tableSeconds'), whole(goldenCase, 'sessionSeconds'), whole(goldenCase, 'playedSeconds'));
    expect(seconds).toBe(BigInt(goldenExpected(goldenCase, 'seconds')));
  });

  it.each(casesFor(golden, 'rake_share'))('%s', (_description, goldenCase) => {
    expect(rakeShare(amount(goldenInput(goldenCase, 'rake')), whole(goldenCase, 'seated'))).toBe(amount(goldenExpected(goldenCase, 'share')));
  });
});

import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden, type GoldenCase } from '@rivr/testing';
import pointsJson from '@rivr/testing/golden/points.json';
import { describe, expect, it } from 'vitest';
import type { Paise } from '../money/index.ts';
import { parseRupees } from '../money/parse-rupees.ts';
import { pointsForTime, rakePoints, rakeShare, tablePlayedSeconds } from './points.ts';

const golden = readGolden(pointsJson);

/** Reads a fixture amount such as "₹612.40". The fixture is wrong if it does not parse. */
function amount(text: string): Paise {
  const parsed = parseRupees(text);
  if (!parsed.ok) throw new Error(`Golden amount "${text}" does not parse: ${parsed.error}`);
  return parsed.value;
}

const whole = (goldenCase: GoldenCase, name: string) => BigInt(goldenInput(goldenCase, name));

describe('points golden fixtures (packages/testing/golden/points.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['time', 'table_time', 'rake_share', 'rake_points'])).not.toThrow();
  });

  it.each(casesFor(golden, 'time'))('%s', (_description, goldenCase) => {
    expect(pointsForTime(whole(goldenCase, 'seconds'), whole(goldenCase, 'perHour'))).toBe(BigInt(goldenExpected(goldenCase, 'points')));
  });

  it.each(casesFor(golden, 'table_time'))('%s', (_description, goldenCase) => {
    const seconds = tablePlayedSeconds(whole(goldenCase, 'tableSeconds'), whole(goldenCase, 'sessionSeconds'), whole(goldenCase, 'playedSeconds'));
    expect(seconds).toBe(BigInt(goldenExpected(goldenCase, 'seconds')));
  });

  it.each(casesFor(golden, 'rake_share'))('%s', (_description, goldenCase) => {
    expect(rakeShare(amount(goldenInput(goldenCase, 'rake')), whole(goldenCase, 'seated'))).toBe(amount(goldenExpected(goldenCase, 'share')));
  });

  it.each(casesFor(golden, 'rake_points'))('%s', (_description, goldenCase) => {
    expect(rakePoints(amount(goldenInput(goldenCase, 'share')), whole(goldenCase, 'rate'))).toBe(BigInt(goldenExpected(goldenCase, 'points')));
  });
});

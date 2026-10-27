import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden } from '@rivr/testing';
import accommodationJson from '@rivr/testing/golden/accommodation.json';
import { describe, expect, it } from 'vitest';
import { nightsForTime } from './nights.ts';

const golden = readGolden(accommodationJson);

describe('accommodation golden fixtures (packages/testing/golden/accommodation.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['nights'])).not.toThrow();
  });

  it.each(casesFor(golden, 'nights'))('%s', (_description, goldenCase) => {
    const nights = nightsForTime(BigInt(goldenInput(goldenCase, 'seconds')), BigInt(goldenInput(goldenCase, 'hoursPerNight')));
    expect(nights).toBe(BigInt(goldenExpected(goldenCase, 'thousandths')));
  });
});

describe('nightsForTime', () => {
  it('refuses a negative time, and a rate under an hour a night', () => {
    expect(() => nightsForTime(-1n, 20n)).toThrow(new RangeError('Time played is never negative'));
    expect(() => nightsForTime(3_600n, 0n)).toThrow(new RangeError('A night takes an hour or more'));
  });
});

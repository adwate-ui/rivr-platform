import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden } from '@rivr/testing';
import learnPointsJson from '@rivr/testing/golden/learnPoints.json';
import { describe, expect, it } from 'vitest';
import { learnPoints } from './learnPoints.ts';

const golden = readGolden(learnPointsJson);

describe('Learn points golden fixtures (packages/testing/golden/learnPoints.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['points'])).not.toThrow();
  });

  it.each(casesFor(golden, 'points'))('%s', (_description, goldenCase) => {
    const input = (name: string) => BigInt(goldenInput(goldenCase, name));
    const points = learnPoints(input('mastered'), input('earnedToday'),
      { perSession: input('perSession'), perPrinciple: input('perPrinciple'), dailyCap: input('dailyCap') });
    expect(points).toBe(BigInt(goldenExpected(goldenCase, 'points')));
  });
});

describe('learnPoints', () => {
  it('refuses a negative count, total or rate', () => {
    const rates = { perSession: 10n, perPrinciple: 25n, dailyCap: 100n };
    expect(() => learnPoints(-1n, 0n, rates)).toThrow(new RangeError('Counts and points earned are never negative'));
    expect(() => learnPoints(0n, -1n, rates)).toThrow(new RangeError('Counts and points earned are never negative'));
    expect(() => learnPoints(0n, 0n, { ...rates, perSession: -1n })).toThrow(new RangeError('Rates are never negative'));
    expect(() => learnPoints(0n, 0n, { ...rates, perPrinciple: -1n })).toThrow(new RangeError('Rates are never negative'));
    expect(() => learnPoints(0n, 0n, { ...rates, dailyCap: -1n })).toThrow(new RangeError('Rates are never negative'));
  });
});

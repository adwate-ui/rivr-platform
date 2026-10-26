import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden, type GoldenCase } from '@rivr/testing';
import leagueJson from '@rivr/testing/golden/league.json';
import { describe, expect, it } from 'vitest';
import { leagueFinishPoints, leagueMonth } from './league.ts';

const golden = readGolden(leagueJson);

const whole = (goldenCase: GoldenCase, name: string) => BigInt(goldenInput(goldenCase, name));

describe('League golden fixtures (packages/testing/golden/league.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['finish', 'month'])).not.toThrow();
  });

  it.each(casesFor(golden, 'finish'))('%s', (_description, goldenCase) => {
    const schedule = {
      first: whole(goldenCase, 'first'), second: whole(goldenCase, 'second'), third: whole(goldenCase, 'third'),
      finalTable: whole(goldenCase, 'finalTable'), entry: whole(goldenCase, 'entry'),
    };
    expect(leagueFinishPoints(whole(goldenCase, 'place'), schedule)).toBe(BigInt(goldenExpected(goldenCase, 'points')));
  });

  it.each(casesFor(golden, 'month'))('%s', (_description, goldenCase) => {
    expect(leagueMonth(new Date(goldenInput(goldenCase, 'at')))).toBe(goldenExpected(goldenCase, 'month'));
  });
});

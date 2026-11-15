import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden } from '@rivr/testing';
import hoursJson from '@rivr/testing/golden/hours.json';
import { describe, expect, it } from 'vitest';
import { countedSeconds } from './hours.ts';

const golden = readGolden(hoursJson);

/** The moment hours count from in a fixture: an ISO time, or `never` for a member never reset. */
const moment = (text: string) => (text === 'never' ? null : new Date(text));

describe('hours golden fixtures (packages/testing/golden/hours.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['counted'])).not.toThrow();
  });

  it.each(casesFor(golden, 'counted'))('%s', (_description, goldenCase) => {
    const stint = {
      from: new Date(goldenInput(goldenCase, 'from')), to: new Date(goldenInput(goldenCase, 'to')),
      playedSeconds: BigInt(goldenInput(goldenCase, 'playedSeconds')),
    };
    expect(countedSeconds(stint, moment(goldenInput(goldenCase, 'countedFrom')))).toBe(BigInt(goldenExpected(goldenCase, 'seconds')));
  });
});

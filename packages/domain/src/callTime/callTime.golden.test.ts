import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden } from '@rivr/testing';
import callTimeJson from '@rivr/testing/golden/callTime.json';
import { describe, expect, it } from 'vitest';
import { callTime } from './callTime.ts';

const golden = readGolden(callTimeJson);

/** Reads a fixture time; empty is none. */
function moment(text: string): Date | null {
  return text === '' ? null : new Date(text);
}

describe('Call time golden fixtures (packages/testing/golden/callTime.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['call_time'])).not.toThrow();
  });

  it.each(casesFor(golden, 'call_time'))('%s', (_description, goldenCase) => {
    const seated = moment(goldenInput(goldenCase, 'seated'));
    const at = moment(goldenInput(goldenCase, 'at'));
    if (seated === null || at === null) throw new Error('A call time case needs its seating and the moment it is read');
    const result = callTime({
      minutes: Number(goldenInput(goldenCase, 'minutes')),
      seatedAt: seated,
      awaySeconds: Number(goldenInput(goldenCase, 'awaySeconds')),
      awaySince: moment(goldenInput(goldenCase, 'awaySince')),
      leftAt: moment(goldenInput(goldenCase, 'left')),
    }, at);
    expect(result).toEqual({ secondsLeft: Number(goldenExpected(goldenCase, 'secondsLeft')), isComplete: goldenExpected(goldenCase, 'complete') === 'yes' });
  });
});

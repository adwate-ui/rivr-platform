import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden } from '@rivr/testing';
import choiceJson from '@rivr/testing/golden/callTimeChoice.json';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CALL_TIME_CAP_MINUTES, callTimeChoiceEnd } from './index.ts';

const golden = readGolden(choiceJson);

describe('Call time set or extended, golden fixtures (packages/testing/golden/callTimeChoice.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['choose'])).not.toThrow();
  });

  it.each(casesFor(golden, 'choose'))('%s', (_description, goldenCase) => {
    const seat = {
      currentMinutes: Number(goldenInput(goldenCase, 'current')), playedMinutes: Number(goldenInput(goldenCase, 'played')),
      initialMinutes: Number(goldenInput(goldenCase, 'initial')), isSet: goldenInput(goldenCase, 'set') === 'yes',
    };
    const refusal = goldenExpected(goldenCase, 'refusal');
    expect(callTimeChoiceEnd(seat, Number(goldenInput(goldenCase, 'length'))))
      .toEqual(refusal === '' ? { ok: true, value: Number(goldenExpected(goldenCase, 'minutes')) } : { ok: false, error: refusal });
  });
});

describe('a length of call time chosen for a seat (the owner, 18 Nov)', () => {
  const whole = fc.integer({ min: -100, max: 2000 });
  const length = fc.integer({ min: 1, max: CALL_TIME_CAP_MINUTES });

  it('until set, is the whole minutes played plus the length, after the call time the seat started with, never past a day', () => {
    fc.assert(fc.property(whole, whole, whole, length, (current, played, initial, chosen) => {
      const result = callTimeChoiceEnd({ currentMinutes: current, playedMinutes: played, initialMinutes: initial, isSet: false }, chosen);
      const total = Math.max(played, 0) + chosen;
      if (result.ok) {
        expect(result.value).toBe(total);
        expect(result.value).toBeGreaterThan(initial);
        expect(result.value).toBeGreaterThanOrEqual(current);
        expect(result.value).toBeLessThanOrEqual(CALL_TIME_CAP_MINUTES);
      } else {
        expect(current <= 0 || total > CALL_TIME_CAP_MINUTES || total <= initial || total < current).toBe(true);
      }
    }));
  });

  it('once set, adds the length to the later of the call time and the minutes played, never past a day', () => {
    fc.assert(fc.property(whole, whole, length, (current, played, chosen) => {
      const result = callTimeChoiceEnd({ currentMinutes: current, playedMinutes: played, initialMinutes: current, isSet: true }, chosen);
      const total = Math.max(current, played, 0) + chosen;
      if (result.ok) expect(result.value).toBe(total);
      else expect(current <= 0 || total > CALL_TIME_CAP_MINUTES).toBe(true);
    }));
  });

  it('floors minutes played, and reads none or not a number as nought', () => {
    const notSet = { currentMinutes: 180, initialMinutes: 180, isSet: false };
    expect(callTimeChoiceEnd({ ...notSet, playedMinutes: 120.9 }, 60)).toEqual({ ok: false, error: 'not_after_call_time' });
    expect(callTimeChoiceEnd({ ...notSet, playedMinutes: 121.2 }, 60)).toEqual({ ok: true, value: 181 });
    expect(callTimeChoiceEnd({ ...notSet, playedMinutes: Number.NaN }, 181)).toEqual({ ok: true, value: 181 });
    expect(callTimeChoiceEnd({ ...notSet, currentMinutes: 180.5, playedMinutes: 10 }, 300)).toEqual({ ok: false, error: 'no_call_time' });
  });
});

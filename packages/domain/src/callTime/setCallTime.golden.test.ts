import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden } from '@rivr/testing';
import setJson from '@rivr/testing/golden/callTimeSet.json';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CALL_TIME_CAP_MINUTES, canSetCallTime, setCallTime } from './index.ts';

const golden = readGolden(setJson);

describe('Call time set by the member, golden fixtures (packages/testing/golden/callTimeSet.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['set'])).not.toThrow();
  });

  it.each(casesFor(golden, 'set'))('%s', (_description, goldenCase) => {
    const result = setCallTime(Number(goldenInput(goldenCase, 'current')), Number(goldenInput(goldenCase, 'played')),
      Number(goldenInput(goldenCase, 'length')));
    const refusal = goldenExpected(goldenCase, 'refusal');
    expect(result).toEqual(refusal === '' ? { ok: true, value: Number(goldenExpected(goldenCase, 'minutes')) } : { ok: false, error: refusal });
  });
});

describe('a call time the member sets (the owner, 17 Nov)', () => {
  it('is the whole minutes played plus the length, never before the call time owed, never past a day', () => {
    const whole = fc.integer({ min: -100, max: 2000 });
    fc.assert(fc.property(whole, whole, fc.integer({ min: 1, max: CALL_TIME_CAP_MINUTES }), (current, played, length) => {
      const result = setCallTime(current, played, length);
      const total = Math.max(played, 0) + length;
      if (result.ok) {
        expect(result.value).toBe(total);
        expect(result.value).toBeGreaterThanOrEqual(current);
        expect(result.value).toBeLessThanOrEqual(CALL_TIME_CAP_MINUTES);
        expect(current).toBeGreaterThan(0);
      } else {
        expect(current <= 0 || total > CALL_TIME_CAP_MINUTES || total < current).toBe(true);
      }
    }));
  });

  it('floors the minutes played, and sets none on a seat whose call time is none or not whole minutes', () => {
    expect(setCallTime(180, 119.9, 60)).toEqual({ ok: false, error: 'before_call_time' });
    expect(setCallTime(180, 120.9, 60)).toEqual({ ok: true, value: 180 });
    expect(setCallTime(Number.NaN, 10, 30)).toEqual({ ok: false, error: 'no_call_time' });
    expect(setCallTime(180.5, 10, 300)).toEqual({ ok: false, error: 'no_call_time' });
    expect(setCallTime(180, Number.NaN, 180)).toEqual({ ok: true, value: 180 });
  });

  it('is open in the app for a length at least the minutes of call time left, rounded up, and for any once it is met', () => {
    // 80 minutes and 30 seconds left: 81 minutes or more.
    expect(canSetCallTime(60, 4830)).toBe(false);
    expect(canSetCallTime(80, 4830)).toBe(false);
    expect(canSetCallTime(81, 4830)).toBe(true);
    expect(canSetCallTime(120, 4830)).toBe(true);
    expect(canSetCallTime(30, 0)).toBe(true);
    expect(canSetCallTime(0, 0)).toBe(false);
    expect(canSetCallTime(1441, 0)).toBe(false);
  });

  it('agrees with what the server sets, wherever the app offers a length', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 600 }), fc.integer({ min: 0, max: 600 * 60 }), fc.integer({ min: 1, max: 240 }),
      (current, playedSeconds, length) => {
        const secondsLeft = Math.max(0, current * 60 - playedSeconds);
        const server = setCallTime(current, playedSeconds / 60, length);
        if (canSetCallTime(length, secondsLeft)) expect(server.ok).toBe(true);
        else expect(server).toEqual({ ok: false, error: 'before_call_time' });
      }));
  });
});

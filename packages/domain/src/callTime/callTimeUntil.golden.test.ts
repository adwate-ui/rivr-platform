import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden, type GoldenCase } from '@rivr/testing';
import untilJson from '@rivr/testing/golden/callTimeUntil.json';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CALL_TIME_CAP_MINUTES, callTimeOpensAfter, callTimeUntil, type SeatCallClock } from './index.ts';

const golden = readGolden(untilJson);

const seatOf = (goldenCase: GoldenCase): SeatCallClock => ({
  currentMinutes: Number(goldenInput(goldenCase, 'current')), playedSeconds: Number(goldenInput(goldenCase, 'played')),
  initialMinutes: Number(goldenInput(goldenCase, 'initial')), isSet: goldenInput(goldenCase, 'set') === 'yes',
});

describe('Call time set or extended to a time, golden fixtures (packages/testing/golden/callTimeUntil.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['until', 'opens'])).not.toThrow();
  });

  it.each(casesFor(golden, 'until'))('%s', (_description, goldenCase) => {
    const refusal = goldenExpected(goldenCase, 'refusal');
    expect(callTimeUntil(seatOf(goldenCase), Number(goldenInput(goldenCase, 'ahead'))))
      .toEqual(refusal === '' ? { ok: true, value: Number(goldenExpected(goldenCase, 'minutes')) } : { ok: false, error: refusal });
  });

  it.each(casesFor(golden, 'opens'))('%s', (_description, goldenCase) => {
    const seconds = goldenExpected(goldenCase, 'seconds');
    expect(callTimeOpensAfter(seatOf(goldenCase))).toBe(seconds === '' ? null : Number(seconds));
  });
});

describe('a call time set or extended to a time (the owner, 22 Nov)', () => {
  const minutes = fc.integer({ min: -100, max: 2000 });
  const seconds = fc.integer({ min: -600, max: 120_000 });
  const seat = fc.record({ currentMinutes: minutes, playedSeconds: seconds, initialMinutes: minutes, isSet: fc.boolean() });

  it('is the seconds played and ahead in minutes rounded up, open just when the time is past where it opens, never past a day', () => {
    fc.assert(fc.property(seat, seconds, (picked, ahead) => {
      const result = callTimeUntil(picked, ahead);
      const opensAfter = callTimeOpensAfter(picked);
      const total = Math.ceil((Math.max(picked.playedSeconds, 0) + ahead) / 60);
      if (opensAfter === null) {
        expect(result).toEqual({ ok: false, error: 'no_call_time' });
      } else if (ahead > 0 && total <= CALL_TIME_CAP_MINUTES) {
        expect(result.ok).toBe(ahead > opensAfter);
        if (result.ok) expect(result.value).toBe(total);
      } else {
        expect(result.ok).toBe(false);
      }
    }));
  });

  it('until set, makes more than the minimum and no less than the call time owed; once set, more than the call time now', () => {
    fc.assert(fc.property(seat, seconds, (picked, ahead) => {
      const result = callTimeUntil(picked, ahead);
      if (!result.ok) return;
      if (picked.isSet) {
        expect(result.value).toBeGreaterThan(picked.currentMinutes);
      } else {
        expect(result.value).toBeGreaterThan(picked.initialMinutes);
        expect(result.value).toBeGreaterThanOrEqual(picked.currentMinutes);
      }
    }));
  });

  it('floors seconds played, and reads none or not a number as nought', () => {
    const notSet = { currentMinutes: 180, initialMinutes: 180, isSet: false };
    expect(callTimeUntil({ ...notSet, playedSeconds: 6000.9 }, 4800)).toEqual({ ok: false, error: 'too_early' });
    expect(callTimeUntil({ ...notSet, playedSeconds: Number.NaN }, 10_801)).toEqual({ ok: true, value: 181 });
    expect(callTimeOpensAfter({ ...notSet, playedSeconds: Number.NaN })).toBe(10_800);
    expect(callTimeUntil({ ...notSet, playedSeconds: 600 }, Number.NaN)).toEqual({ ok: false, error: 'not_ahead' });
    expect(callTimeUntil({ ...notSet, currentMinutes: 180.5, playedSeconds: 10 }, 3600)).toEqual({ ok: false, error: 'no_call_time' });
  });
});

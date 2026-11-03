import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden } from '@rivr/testing';
import extensionJson from '@rivr/testing/golden/callTimeExtension.json';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ADD_TIME_CHOICES, ADD_TIME_PRESETS, CALL_TIME_CAP_MINUTES, extendedCallTime, isAddTimeChoice } from './index.ts';

const golden = readGolden(extensionJson);

describe('Call time extension golden fixtures (packages/testing/golden/callTimeExtension.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['extend'])).not.toThrow();
  });

  it.each(casesFor(golden, 'extend'))('%s', (_description, goldenCase) => {
    const result = extendedCallTime(Number(goldenInput(goldenCase, 'current')), Number(goldenInput(goldenCase, 'played')),
      Number(goldenInput(goldenCase, 'add')));
    const refusal = goldenExpected(goldenCase, 'refusal');
    expect(result).toEqual(refusal === '' ? { ok: true, value: Number(goldenExpected(goldenCase, 'minutes')) } : { ok: false, error: refusal });
  });
});

describe('the lengths the club may offer (decision 0305)', () => {
  it('are eight presets, and 30 minutes, an hour and two hours until the club ticks its own', () => {
    expect(ADD_TIME_PRESETS).toEqual([15, 30, 45, 60, 90, 120, 180, 240]);
    expect(ADD_TIME_CHOICES).toEqual([30, 60, 120]);
    expect([15, 45, 90, 240, 0, 50, -30, 300].map(isAddTimeChoice)).toEqual([true, true, true, true, false, false, false, false]);
  });

  it('only ever add the whole length asked for, from the later of the call time and the time played, never past a day', () => {
    const whole = fc.integer({ min: -100, max: 2000 });
    fc.assert(fc.property(whole, whole, fc.constantFrom(...ADD_TIME_PRESETS), (current, played, add) => {
      const result = extendedCallTime(current, played, add);
      const from = Math.max(current, played, 0);
      if (result.ok) {
        expect(result.value).toBe(from + add);
        expect(result.value).toBeLessThanOrEqual(CALL_TIME_CAP_MINUTES);
        expect(result.value).toBeGreaterThan(current);
        expect(current).toBeGreaterThan(0);
      } else {
        expect(current <= 0 || from + add > CALL_TIME_CAP_MINUTES).toBe(true);
      }
    }));
  });

  it('refuse a call time that is not whole minutes, floor the time played, and count none as nought', () => {
    expect(extendedCallTime(Number.NaN, 0, 60)).toEqual({ ok: false, error: 'no_call_time' });
    expect(extendedCallTime(180.5, 0, 60)).toEqual({ ok: false, error: 'no_call_time' });
    expect(extendedCallTime(180, Number.NaN, 60)).toEqual({ ok: true, value: 240 });
    expect(extendedCallTime(180, -30, 60)).toEqual({ ok: true, value: 240 });
    expect(extendedCallTime(180, 200.9, 60)).toEqual({ ok: true, value: 260 });
    expect(extendedCallTime(180, 200, 60)).toEqual({ ok: true, value: 260 });
  });
});

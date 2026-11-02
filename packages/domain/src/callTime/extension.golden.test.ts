import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden } from '@rivr/testing';
import extensionJson from '@rivr/testing/golden/callTimeExtension.json';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ADD_TIME_CHOICES, CALL_TIME_CAP_MINUTES, extendedCallTime, isAddTimeChoice } from './index.ts';

const golden = readGolden(extensionJson);

describe('Call time extension golden fixtures (packages/testing/golden/callTimeExtension.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['extend'])).not.toThrow();
  });

  it.each(casesFor(golden, 'extend'))('%s', (_description, goldenCase) => {
    const result = extendedCallTime(Number(goldenInput(goldenCase, 'current')), Number(goldenInput(goldenCase, 'add')));
    const refusal = goldenExpected(goldenCase, 'refusal');
    expect(result).toEqual(refusal === '' ? { ok: true, value: Number(goldenExpected(goldenCase, 'minutes')) } : { ok: false, error: refusal });
  });
});

describe('the lengths a member may ask for (decision 0320)', () => {
  it('are 30 minutes, an hour and two hours, and nothing else', () => {
    expect(ADD_TIME_CHOICES).toEqual([30, 60, 120]);
    expect([30, 60, 120, 0, 45, 90, -30, 180].map(isAddTimeChoice)).toEqual([true, true, true, false, false, false, false, false]);
  });

  it('only ever add the whole length asked for, and never past a day', () => {
    fc.assert(fc.property(fc.integer({ min: -100, max: 2000 }), fc.constantFrom(...ADD_TIME_CHOICES), (current, add) => {
      const result = extendedCallTime(current, add);
      if (result.ok) {
        expect(result.value).toBe(current + add);
        expect(result.value).toBeLessThanOrEqual(CALL_TIME_CAP_MINUTES);
        expect(current).toBeGreaterThan(0);
      } else {
        expect(current <= 0 || current + add > CALL_TIME_CAP_MINUTES).toBe(true);
      }
    }));
  });
});

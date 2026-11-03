import { scheduleSchema } from '@rivr/contracts/promotionModel';
import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden } from '@rivr/testing';
import scheduleJson from '@rivr/testing/golden/promotionSchedule.json';
import { describe, expect, it } from 'vitest';
import { isInSchedule, secondsInSchedule } from './schedule.ts';

const golden = readGolden(scheduleJson);

/** A fixture's schedule, checked as the database checks it: the fixture is wrong if it does not parse. */
const scheduleOf = (text: string) => scheduleSchema.parse(JSON.parse(text));

describe('Promotion schedule golden fixtures (packages/testing/golden/promotionSchedule.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['in', 'seconds'])).not.toThrow();
  });

  it.each(casesFor(golden, 'in'))('%s', (_, goldenCase) => {
    const inSchedule = isInSchedule(scheduleOf(goldenInput(goldenCase, 'schedule')), new Date(goldenInput(goldenCase, 'at')));
    expect(inSchedule ? 'yes' : 'no').toBe(goldenExpected(goldenCase, 'inSchedule'));
  });

  it.each(casesFor(golden, 'seconds'))('%s', (_, goldenCase) => {
    const span = { from: new Date(goldenInput(goldenCase, 'from')), to: new Date(goldenInput(goldenCase, 'to')) };
    expect(String(secondsInSchedule(span, scheduleOf(goldenInput(goldenCase, 'schedule'))))).toBe(goldenExpected(goldenCase, 'seconds'));
  });
});

import type { Schedule } from '@rivr/contracts/promotionModel';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { isInSchedule, secondsInSchedule } from './schedule.ts';

/** A span of up to three days, in whole seconds, within a few weeks of the launch. */
const LAUNCH_MS = Date.parse('2026-11-15T06:00:00+05:30');
const span = fc.tuple(fc.integer({ min: 0, max: 30 * 86_400 }), fc.integer({ min: 0, max: 3 * 86_400 })).map(([start, length]) => ({
  from: new Date(LAUNCH_MS + start * 1000),
  to: new Date(LAUNCH_MS + (start + length) * 1000),
}));
const lengthOf = (played: { from: Date; to: Date }) => (played.to.getTime() - played.from.getTime()) / 1000;
const clock = fc.tuple(fc.integer({ min: 0, max: 23 }), fc.constantFrom(0, 30)).map(([hours, minutes]) =>
  `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
const day = fc.integer({ min: 0, max: 40 }).map((offset) => new Date(Date.parse('2026-11-01T00:00:00Z') + offset * 86_400_000).toISOString().slice(0, 10));
const schedule: fc.Arbitrary<Schedule> = fc.record({
  days: fc.uniqueArray(fc.integer({ min: 1, max: 7 }), { minLength: 1, maxLength: 7 }),
  from: clock,
  to: clock,
  startsOn: day,
  timezone: fc.constant('Asia/Kolkata' as const),
});

describe('schedule properties', () => {
  it('counts no more of a span than its length, and never less than nothing', () => {
    fc.assert(fc.property(span, schedule, (played, when) => {
      const seconds = secondsInSchedule(played, when);
      expect(seconds >= 0 && seconds <= lengthOf(played)).toBe(true);
    }));
  });

  it('counts the whole span every day from 06:00 to 06:00', () => {
    fc.assert(fc.property(span, (played) => {
      const always: Schedule = { days: [1, 2, 3, 4, 5, 6, 7], from: '06:00', to: '06:00', startsOn: '2026-01-01', timezone: 'Asia/Kolkata' };
      expect(secondsInSchedule(played, always)).toBe(lengthOf(played));
    }));
  });

  it('counts a span split in two as the sum of its parts', () => {
    fc.assert(fc.property(span, fc.double({ min: 0, max: 1, noNaN: true }), schedule, (played, share, when) => {
      const split = new Date(played.from.getTime() + Math.floor(lengthOf(played) * share) * 1000);
      const parts = secondsInSchedule({ from: played.from, to: split }, when) + secondsInSchedule({ from: split, to: played.to }, when);
      expect(parts).toBe(secondsInSchedule(played, when));
    }));
  });

  it('counts a second as inside exactly when its moment is in the schedule', () => {
    fc.assert(fc.property(span, schedule, (played, when) => {
      const second = { from: played.from, to: new Date(played.from.getTime() + 1000) };
      expect(secondsInSchedule(second, when) === 1).toBe(isInSchedule(when, played.from));
    }));
  });
});

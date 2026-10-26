import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { secondsInWindow } from './window.ts';

/** A stint of up to three days, in whole seconds, starting within a few weeks of the launch. */
const LAUNCH_MS = Date.parse('2026-11-15T06:00:00+05:30');
const stint = fc.tuple(fc.integer({ min: 0, max: 30 * 86_400 }), fc.integer({ min: 0, max: 3 * 86_400 })).map(([start, length]) => ({
  from: new Date(LAUNCH_MS + start * 1000),
  to: new Date(LAUNCH_MS + (start + length) * 1000),
}));
const lengthOf = (span: { from: Date; to: Date }) => BigInt((span.to.getTime() - span.from.getTime()) / 1000);
/** A window given whole, on the hour: it opens before it closes within the club's day (06:00 to 06:00). */
const clock = (clubHour: number) => `${String((clubHour + 6) % 24).padStart(2, '0')}:00`;
const times = fc.tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 1, max: 24 })).filter(([from, until]) => from < until)
  .map(([from, until]) => ({ from: clock(from), until: clock(until) }));
const days = fc.uniqueArray(fc.integer({ min: 1, max: 7 }), { minLength: 1, maxLength: 7 });

describe('secondsInWindow properties', () => {
  it('counts no more of a stint than its length', () => {
    fc.assert(fc.property(stint, times, days, (span, window, onDays) => {
      const seconds = secondsInWindow(span, { ...window, days: onDays });
      expect(seconds >= 0n && seconds <= lengthOf(span)).toBe(true);
    }));
  });

  it('counts the whole stint when the window is every day, all day', () => {
    fc.assert(fc.property(stint, (span) => {
      expect(secondsInWindow(span, {})).toBe(lengthOf(span));
      expect(secondsInWindow(span, { days: [1, 2, 3, 4, 5, 6, 7], from: '06:00', until: '06:00' })).toBe(lengthOf(span));
    }));
  });

  it('counts a stint split in two as the sum of its parts', () => {
    fc.assert(fc.property(stint, fc.double({ min: 0, max: 1, noNaN: true }), times, days, (span, at, window, onDays) => {
      const split = new Date(span.from.getTime() + Math.floor((span.to.getTime() - span.from.getTime()) * at / 1000) * 1000);
      const conditions = { ...window, days: onDays };
      const whole = secondsInWindow(span, conditions);
      expect(secondsInWindow({ from: span.from, to: split }, conditions) + secondsInWindow({ from: split, to: span.to }, conditions)).toBe(whole);
    }));
  });

  it('splits a stint between days that cover the week, without losing or doubling time', () => {
    fc.assert(fc.property(stint, days, (span, onDays) => {
      const others = [1, 2, 3, 4, 5, 6, 7].filter((day) => !onDays.includes(day));
      const rest = others.length === 0 ? 0n : secondsInWindow(span, { days: others });
      expect(secondsInWindow(span, { days: onDays }) + rest).toBe(lengthOf(span));
    }));
  });
});

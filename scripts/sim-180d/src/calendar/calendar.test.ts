import { describe, expect, it } from 'vitest';
import { buildCalendar, NIGHTS } from './calendar.ts';
import { createRandom } from './random.ts';

const calendar = buildCalendar();
const night = (date: string) => calendar.find((each) => each.date === date);

describe('buildCalendar', () => {
  it('runs 180 nights, from 15 Nov 2026 to 13 May 2027', () => {
    expect(calendar).toHaveLength(NIGHTS);
    expect(calendar[0]).toMatchObject({ n: 1, date: '2026-11-15', weekday: 0 });
    expect(calendar[179]?.date).toBe('2027-05-13');
  });

  it('expects about half as many again on Fridays and Saturdays', () => {
    const thursday = night('2027-02-04');
    const friday = night('2027-02-05');
    expect(thursday && friday && friday.expected / thursday.expected).toBeCloseTo(1.5, 1);
  });

  it('makes Christmas Eve, Christmas, New Year’s Eve and Holi peaks, New Year’s Eve the busiest', () => {
    for (const date of ['2026-12-24', '2026-12-25', '2026-12-31', '2027-03-22']) expect(night(date)?.peak, date).toBe(true);
    const busiest = [...calendar].sort((a, b) => b.expected - a.expected)[0];
    expect(busiest?.date).toBe('2026-12-31');
  });

  it('expects 40 to 90 players, and more only on New Year’s Eve', () => {
    for (const each of calendar) {
      expect(each.expected).toBeGreaterThanOrEqual(40);
      if (each.date !== '2026-12-31') expect(each.expected, each.date).toBeLessThanOrEqual(90);
    }
    expect(night('2026-12-31')?.expected).toBeGreaterThan(90);
  });

  it('puts each scripted event on one night, and 1 April in the run', () => {
    const events = calendar.flatMap((each) => each.events);
    expect(new Set(events).size).toBe(events.length);
    expect(night('2026-11-15')?.events).toContain('launch');
    expect(night('2027-04-01')?.events).toContain('year_start');
  });
});

describe('createRandom', () => {
  it('gives the same numbers from the same seed', () => {
    const a = createRandom(7);
    const b = createRandom(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('stays between 0 and 1', () => {
    const random = createRandom(1);
    for (let i = 0; i < 1000; i += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

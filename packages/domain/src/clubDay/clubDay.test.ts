import { describe, expect, it } from 'vitest';
import { clubDay, clubDaysPeriod } from './clubDay.ts';

describe('the club\'s day, 06:00 to 06:00 IST', () => {
  it('holds the night past midnight, and turns at 06:00 IST', () => {
    expect(clubDay(new Date('2026-11-15T15:30:00Z'))).toBe('2026-11-15');
    expect(clubDay(new Date('2026-11-15T20:30:00Z'))).toBe('2026-11-15');
    expect(clubDay(new Date('2026-11-16T00:29:59Z'))).toBe('2026-11-15');
    expect(clubDay(new Date('2026-11-16T00:30:00Z'))).toBe('2026-11-16');
  });

  it('a run of days begins at 06:00 IST on the first and ends at 06:00 IST after the last', () => {
    const period = clubDaysPeriod('2026-11-15', '2026-11-16');
    expect([period.start.toISOString(), period.end.toISOString()]).toEqual(['2026-11-15T00:30:00.000Z', '2026-11-17T00:30:00.000Z']);
    const one = clubDaysPeriod('2026-12-31', '2026-12-31');
    expect([one.start.toISOString(), one.end.toISOString()]).toEqual(['2026-12-31T00:30:00.000Z', '2027-01-01T00:30:00.000Z']);
  });
});

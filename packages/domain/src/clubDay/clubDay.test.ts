import { describe, expect, it } from 'vitest';
import { clubDay, clubDaysPeriod, dayAfter, lastDayOfMonth, recentClubMonths, weekOf } from './clubDay.ts';

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

  it("names the recent club months by their first days, the club day's own first, across a year's turn", () => {
    expect(recentClubMonths(new Date('2027-02-01T00:29:59Z'), 3)).toEqual(['2027-01-01', '2026-12-01', '2026-11-01']);
    expect(recentClubMonths(new Date('2027-02-01T00:30:00Z'), 2)).toEqual(['2027-02-01', '2027-01-01']);
  });

  it("gives a month's last day, February's in a leap year too", () => {
    expect(lastDayOfMonth('2026-02-01')).toBe('2026-02-28');
    expect(lastDayOfMonth('2028-02-01')).toBe('2028-02-29');
    expect(lastDayOfMonth('2026-12-01')).toBe('2026-12-31');
  });

  it('counts days on and back, across a month and a year', () => {
    expect(dayAfter('2026-11-15', 1)).toBe('2026-11-16');
    expect(dayAfter('2026-11-30', 1)).toBe('2026-12-01');
    expect(dayAfter('2027-01-01', -1)).toBe('2026-12-31');
    expect(dayAfter('2026-11-15', 0)).toBe('2026-11-15');
  });

  it("names a club week by its Monday, the Monday's own and the Sunday's alike", () => {
    expect(weekOf('2026-11-18')).toBe('2026-11-16');
    expect(weekOf('2026-11-16')).toBe('2026-11-16');
    expect(weekOf('2026-11-22')).toBe('2026-11-16');
    expect(weekOf('2027-01-01')).toBe('2026-12-28');
  });
});

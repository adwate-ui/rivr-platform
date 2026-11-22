import { describe, expect, it } from 'vitest';
import {
  clockTimeAfter, clubDay, clubDayMoment, clubDaysPeriod, dayAfter, lastDayOfMonth, nearestClockMoment, recentClubMonths, weekOf,
} from './clubDay.ts';

describe('a time picked on India\'s clock', () => {
  it('is the time the clock shows nearest now: past midnight ahead, a time just gone behind', () => {
    const evening = new Date('2026-11-22T15:30:00Z'); // 21:00 IST
    expect(nearestClockMoment('23:40', evening)?.toISOString()).toBe('2026-11-22T18:10:00.000Z');
    expect(nearestClockMoment('01:30', evening)?.toISOString()).toBe('2026-11-22T20:00:00.000Z');
    expect(nearestClockMoment('21:00', evening)?.toISOString()).toBe('2026-11-22T15:30:00.000Z');
    expect(nearestClockMoment('20:00', evening)?.toISOString()).toBe('2026-11-22T14:30:00.000Z');
    // 11:30 picked for 23:30, a slip of AM for PM, is the one gone by, not a call time of most of a day.
    expect(nearestClockMoment('11:30', evening)?.toISOString()).toBe('2026-11-22T06:00:00.000Z');
  });

  it('takes the time ahead when it is twelve hours either way, and crosses midnight IST from the small hours', () => {
    const evening = new Date('2026-11-22T15:30:00Z'); // 21:00 IST
    expect(nearestClockMoment('09:00', evening)?.toISOString()).toBe('2026-11-23T03:30:00.000Z');
    const late = new Date('2026-11-22T19:20:00Z'); // 00:50 IST on the 23rd
    expect(nearestClockMoment('02:00', late)?.toISOString()).toBe('2026-11-22T20:30:00.000Z');
    expect(nearestClockMoment('23:40', late)?.toISOString()).toBe('2026-11-22T18:10:00.000Z');
  });

  it('reads nothing but a 24-hour time', () => {
    expect(['24:00', '9:30', '23:60', '', '23:40:10'].map((time) => nearestClockMoment(time, new Date()))).toEqual([null, null, null, null, null]);
  });

  it('suggests the first mark of the step after a moment, as a time field takes it', () => {
    expect(clockTimeAfter(new Date('2026-11-22T17:42:25Z'), 5)).toBe('23:15');
    expect(clockTimeAfter(new Date('2026-11-22T17:45:00Z'), 5)).toBe('23:20');
    expect(clockTimeAfter(new Date('2026-11-22T18:28:00Z'), 5)).toBe('00:00');
  });
});

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

describe('clubDayMoment', () => {
  it('puts an evening time on the club day\'s date and a small-hours time on the next morning', () => {
    expect(clubDayMoment('2026-11-15', '23:10').toISOString()).toBe('2026-11-15T17:40:00.000Z');
    expect(clubDayMoment('2026-11-15', '06:00').toISOString()).toBe('2026-11-15T00:30:00.000Z');
    expect(clubDayMoment('2026-11-15', '05:59').toISOString()).toBe('2026-11-16T00:29:00.000Z');
    expect(clubDayMoment('2026-11-15', '02:00').toISOString()).toBe('2026-11-15T20:30:00.000Z');
  });
});

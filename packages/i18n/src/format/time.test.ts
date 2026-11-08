import { describe, expect, it } from 'vitest';
import { formatClock, formatCountdown, formatTypedDay, isoDayOfTyped, formatDate, formatHoursMinutes, formatMinutesSeconds, isLaterIstDay, istMidnight, formatDateTime, formatDayMonth, formatDayTime, formatDuration, formatIsoDay, formatMonth, formatMonthYear, formatQuarter, formatTime, formatWeekday, formatWaitingSince } from './time.ts';

// 21:10 UTC on 14 Nov is 02:40 IST on Sunday 15 Nov, the opening night.
const OPENING_NIGHT = new Date('2026-11-14T21:10:00Z');

describe('time and dates are shown in IST', () => {
  it('formats the clock as 24-hour IST', () => {
    expect(formatTime(OPENING_NIGHT)).toBe('02:40');
    expect(formatTime(new Date('2026-11-15T12:30:00Z'))).toBe('18:00');
  });

  it('uses the IST date, not the UTC one', () => {
    expect(formatDate(OPENING_NIGHT)).toBe('15 Nov 2026');
    expect(formatIsoDay(OPENING_NIGHT)).toBe('2026-11-15');
    expect(formatWeekday(OPENING_NIGHT)).toBe('Sunday');
    expect(formatDayTime(OPENING_NIGHT)).toBe('Sun 15 Nov, 02:40');
    expect(formatDateTime(OPENING_NIGHT)).toBe('15 Nov 2026, 02:40');
    expect(istMidnight('2026-11-15')).toBe('2026-11-15T00:00:00+05:30');
    // Late on 14 Nov in UTC is already 15 Nov in IST: only 16 Nov is later.
    expect(isLaterIstDay('2026-11-15', new Date('2026-11-14T20:00:00Z'))).toBe(false);
    expect(isLaterIstDay('2026-11-16', new Date('2026-11-14T20:00:00Z'))).toBe(true);
    expect(isLaterIstDay('16/11/2026', new Date('2026-11-14T20:00:00Z'))).toBe(false);
    expect(formatDayMonth(OPENING_NIGHT)).toBe('15 Nov');
  });

  it('says a time still to run in whole minutes, rounded up', () => {
    expect(formatDuration(4290)).toBe('1 h 12 min');
    expect(formatDuration(7200)).toBe('2 h');
    expect(formatDuration(2700)).toBe('45 min');
    expect(formatDuration(1)).toBe('1 min');
    expect(formatDuration(0)).toBe('0 min');
  });

  it('sets out a typed date of birth as DD / MM / YYYY, and reads it back as an ISO day that exists', () => {
    expect(formatTypedDay('1')).toBe('1');
    expect(formatTypedDay('140')).toBe('14 / 0');
    expect(formatTypedDay('14/03/1990x9')).toBe('14 / 03 / 1990');
    expect(isoDayOfTyped('14 / 03 / 1990')).toBe('1990-03-14');
    expect(isoDayOfTyped('31 / 02 / 1990')).toBeNull();
    expect(isoDayOfTyped('14 / 03')).toBeNull();
  });

  it('writes the redesign\'s clocks and lengths (decision 0320)', () => {
    expect(formatClock(9668)).toBe('2:41:08');
    expect(formatClock(890)).toBe('0:14:50');
    expect(formatClock(-5)).toBe('0:00:00');
    expect(formatMinutesSeconds(1182)).toBe('19:42');
    expect(formatMinutesSeconds(24.9)).toBe('0:24');
    expect(formatHoursMinutes(9668)).toBe('2h 41m');
    expect(formatHoursMinutes(1440)).toBe('0h 24m');
    expect(formatHoursMinutes(14700)).toBe('4h 05m');
  });

  it('shows a countdown as a clock does, in whole seconds', () => {
    expect(formatCountdown(689)).toBe('11:29');
    expect(formatCountdown(300)).toBe('05:00');
    expect(formatCountdown(59.9)).toBe('00:59');
    expect(formatCountdown(4500)).toBe('1:15:00');
    expect(formatCountdown(-3)).toBe('00:00');
  });

  it('names a calendar month, from the month or its first day', () => {
    expect(formatMonth('2026-11')).toBe('November 2026');
    expect(formatMonth('2026-12-01')).toBe('December 2026');
    expect(formatMonth('2027-01-01')).toBe('January 2027');
  });
});

describe('formatQuarter', () => {
  it('names a quarter by its months and year', () => {
    expect(formatQuarter('2026-10-01')).toBe('Oct–Dec 2026');
    expect(formatQuarter('2027-01-01')).toBe('Jan–Mar 2027');
    expect(formatQuarter('2026-04-01')).toBe('Apr–Jun 2026');
  });
});

describe('September (F5-11)', () => {
  it('is Sep, three letters as every other month is', () => {
    const fifteenth = new Date('2026-09-15T06:00:00Z');
    expect(formatDate(fifteenth)).toBe('15 Sep 2026');
    expect(formatDayMonth(fifteenth)).toBe('15 Sep');
    expect(formatDayTime(fifteenth)).toBe('Tue 15 Sep, 11:30');
    expect(formatQuarter('2026-07-01')).toBe('Jul–Sep 2026');
    expect(formatMonthYear(fifteenth)).toBe('Sep 2026');
  });

  it('takes the month in India time: late on 31 August in UTC is 1 Sep there, and 31 December 1 Jan of the next year', () => {
    expect(formatDate(new Date('2026-08-31T20:00:00Z'))).toBe('1 Sep 2026');
    expect(formatDayTime(new Date('2026-12-31T19:00:00Z'))).toBe('Fri 1 Jan, 00:30');
    expect(formatDate(new Date('2026-12-31T19:00:00Z'))).toBe('1 Jan 2027');
    expect(formatMonthYear(new Date('2026-12-31T19:00:00Z'))).toBe('Jan 2027');
  });
});

describe('formatWaitingSince (audit F-090)', () => {
  const since = new Date('2026-11-15T05:30:00Z');

  it('says the day and time alone inside a day', () => {
    expect(formatWaitingSince(since, new Date('2026-11-15T15:00:00Z'))).toBe('Sun 15 Nov, 11:00');
  });

  it('adds the age from a day on, as one day or many', () => {
    expect(formatWaitingSince(since, new Date('2026-11-16T06:00:00Z'))).toBe('Sun 15 Nov, 11:00 · 1 day');
    expect(formatWaitingSince(since, new Date('2026-12-15T06:00:00Z'))).toBe('Sun 15 Nov, 11:00 · 30 days');
  });

  it('gives the year once it is not this one', () => {
    expect(formatWaitingSince(since, new Date('2027-02-13T06:00:00Z'))).toBe('15 Nov 2026, 11:00 · 90 days');
  });
});

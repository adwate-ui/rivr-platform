import { describe, expect, it } from 'vitest';
import { formatCountdown, formatDate, formatDayMonth, formatDayTime, formatDuration, formatTime, formatWeekday } from './time.ts';

// 21:10 UTC on 14 Nov is 02:40 IST on Sunday 15 Nov, the opening night.
const OPENING_NIGHT = new Date('2026-11-14T21:10:00Z');

describe('time and dates are shown in IST', () => {
  it('formats the clock as 24-hour IST', () => {
    expect(formatTime(OPENING_NIGHT)).toBe('02:40');
    expect(formatTime(new Date('2026-11-15T12:30:00Z'))).toBe('18:00');
  });

  it('uses the IST date, not the UTC one', () => {
    expect(formatDate(OPENING_NIGHT)).toBe('15 Nov 2026');
    expect(formatWeekday(OPENING_NIGHT)).toBe('Sunday');
    expect(formatDayTime(OPENING_NIGHT)).toBe('Sun 15 Nov, 02:40');
    expect(formatDayMonth(OPENING_NIGHT)).toBe('15 Nov');
  });

  it('says a time still to run in whole minutes, rounded up', () => {
    expect(formatDuration(4290)).toBe('1 h 12 min');
    expect(formatDuration(7200)).toBe('2 h');
    expect(formatDuration(2700)).toBe('45 min');
    expect(formatDuration(1)).toBe('1 min');
    expect(formatDuration(0)).toBe('0 min');
  });

  it('shows a countdown as a clock does, in whole seconds', () => {
    expect(formatCountdown(689)).toBe('11:29');
    expect(formatCountdown(300)).toBe('05:00');
    expect(formatCountdown(59.9)).toBe('00:59');
    expect(formatCountdown(4500)).toBe('1:15:00');
    expect(formatCountdown(-3)).toBe('00:00');
  });
});

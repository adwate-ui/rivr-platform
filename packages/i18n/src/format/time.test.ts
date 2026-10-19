import { describe, expect, it } from 'vitest';
import { formatDate, formatDayTime, formatTime, formatWeekday } from './time.ts';

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
  });
});

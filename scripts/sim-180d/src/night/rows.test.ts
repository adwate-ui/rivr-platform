import { describe, expect, it } from 'vitest';
import { buildCalendar } from '../calendar/calendar.ts';
import { joinersOn } from '../people/growth.ts';
import { joinerRows, nightRows } from './rows.ts';

describe('nightRows', () => {
  it('inserts all 180 nights with their events', () => {
    const text = nightRows(buildCalendar());
    expect(text.startsWith('insert into sim.night')).toBe(true);
    expect(text.split('\n')).toHaveLength(181);
    expect(text).toContain("(1, '2026-11-15', 40, false, array['launch']::text[])");
    expect(text).toContain("'2026-12-31'");
  });

  it('quotes a quote', () => {
    const text = nightRows([{ n: 1, date: '2026-11-15', weekday: 0, expected: 40, peak: false, events: ["o'clock"] }]);
    expect(text).toContain("array['o''clock']");
  });
});

describe('joinerRows', () => {
  it('numbers joiners from 1 within each night', () => {
    const text = joinerRows(new Map([[3, joinersOn(3)]]));
    expect(text).toContain('(3, 1, ');
    expect(text).not.toContain('(3, 0, ');
  });

  it('is empty when nobody joins', () => {
    expect(joinerRows(new Map([[1, []]]))).toBe('');
  });
});

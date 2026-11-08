import { describe, expect, it } from 'vitest';
import { buildCalendar } from '../calendar/calendar.ts';
import { checkpointNights, scopeOf } from './checkpoints.ts';

describe('checkpointNights', () => {
  it('snapshots day 1, a week, a month, New Year’s Eve, 90 and 180', () => {
    expect(checkpointNights(buildCalendar())).toEqual([1, 7, 30, 47, 90, 180]);
  });

  it('keeps the fixed nights when the calendar has no New Year’s Eve', () => {
    expect(checkpointNights([])).toEqual([1, 7, 30, 90, 180]);
  });
});

describe('scopeOf', () => {
  it('runs the month checks every thirtieth night', () => {
    expect([29, 30, 31, 180].map(scopeOf)).toEqual(['night', 'month', 'night', 'month']);
  });
});

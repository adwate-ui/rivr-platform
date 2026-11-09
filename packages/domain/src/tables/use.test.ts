import { describe, expect, it } from 'vitest';
import { changeFrom, isTableSpan, roomUse, tableSpanDays, tableUse } from './use.ts';

describe('tableUse', () => {
  it('is the seconds played over seats × seconds run, a whole percent rounded down', () => {
    // 4 h 30 min played at a 9-seat table that ran 4 hours: 12.5% → 12.
    expect(tableUse(16_200, 9, 14_400)).toBe(12);
    expect(tableUse(9 * 14_400, 9, 14_400)).toBe(100);
    expect(tableUse(0, 9, 14_400)).toBe(0);
  });

  it('is never above 100, and nothing for a table that never ran or has no seats', () => {
    expect(tableUse(20 * 14_400, 9, 14_400)).toBe(100);
    expect(tableUse(3_600, 9, 0)).toBeNull();
    expect(tableUse(3_600, 0, 3_600)).toBeNull();
  });
});

describe('roomUse', () => {
  it('is the seconds played over the room\'s seat-seconds, as tableUse rounds it', () => {
    expect(roomUse(16_200, 9 * 14_400)).toBe(12);
    expect(roomUse(3_600, 0)).toBeNull();
  });
});

describe('changeFrom', () => {
  it('is the whole-percent change from before, rounded, up or down', () => {
    expect(changeFrom(112, 100)).toBe(12);
    expect(changeFrom(95, 100)).toBe(-5);
    expect(changeFrom(100, 100)).toBe(0);
    expect(changeFrom(1, 3)).toBe(-67);
    expect(changeFrom(0, 100)).toBe(-100);
  });

  it('is nothing with nothing before', () => {
    expect(changeFrom(100, 0)).toBeNull();
    expect(changeFrom(0, 0)).toBeNull();
  });
});

describe('a span of club days', () => {
  it('counts both ends', () => {
    expect(tableSpanDays('2026-11-01', '2026-11-01')).toBe(1);
    expect(tableSpanDays('2026-11-01', '2026-11-30')).toBe(30);
    expect(tableSpanDays('2026-10-25', '2026-10-26')).toBe(2);
  });

  it('runs from 1 to 92 days and none ahead of today', () => {
    expect(isTableSpan('2026-11-01', '2026-11-01', '2026-11-09')).toBe(true);
    expect(isTableSpan('2026-08-09', '2026-11-08', '2026-11-09')).toBe(true);
    expect(isTableSpan('2026-08-08', '2026-11-08', '2026-11-09')).toBe(false);
    expect(isTableSpan('2026-11-05', '2026-11-04', '2026-11-09')).toBe(false);
    expect(isTableSpan('2026-11-05', '2026-11-10', '2026-11-09')).toBe(false);
    expect(isTableSpan('', '2026-11-04', '2026-11-09')).toBe(false);
    expect(isTableSpan('2026-11-04', '', '2026-11-09')).toBe(false);
  });
});

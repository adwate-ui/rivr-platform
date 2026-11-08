import { describe, expect, it } from 'vitest';
import { tableUse } from './use.ts';

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

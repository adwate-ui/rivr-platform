import { describe, expect, it } from 'vitest';
import { isStakeCallTime, stakeTableRefusal } from './index.ts';

describe('a stake given to a table (redesign RD-16)', () => {
  it('is refused, by name, until the stake has a call time above zero', () => {
    expect(stakeTableRefusal(0)).toBe('stake_without_call_time');
    expect(stakeTableRefusal(-30)).toBe('stake_without_call_time');
  });

  it('may be given once it has one, however short', () => {
    expect(stakeTableRefusal(1)).toBeNull();
    expect(stakeTableRefusal(180)).toBeNull();
  });
});

describe('a stake\'s call time', () => {
  it('is whole minutes, above zero and a day at most', () => {
    expect([1, 180, 1440].map(isStakeCallTime)).toEqual([true, true, true]);
    expect([0, -1, 1441, 90.5, Number.NaN].map(isStakeCallTime)).toEqual([false, false, false, false, false]);
  });
});

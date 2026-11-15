import { describe, expect, it } from 'vitest';
import { isSeatCount, SEAT_COUNTS } from './index.ts';

describe('the seats of a table', () => {
  it('are 2 to 10, fewest first', () => {
    expect(SEAT_COUNTS).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('may be any whole count from 2 to 10 and no other', () => {
    expect([2, 6, 10].map(isSeatCount)).toEqual([true, true, true]);
    expect([1, 0, -2, 11, 2.5, Number.NaN].map(isSeatCount)).toEqual([false, false, false, false, false, false]);
  });
});

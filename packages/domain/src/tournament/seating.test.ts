import { describe, expect, it } from 'vitest';
import { averageStack, balancingMoves, eligibleSeats, finishPlace } from './seating.ts';

describe('seating (decision 0204)', () => {
  it('seats a new player only at the emptiest tables with room', () => {
    expect(eligibleSeats([{ table: 1, seat: 1 }], 2, 2)).toEqual([{ table: 2, seat: 1 }, { table: 2, seat: 2 }]);
    expect(eligibleSeats([{ table: 1, seat: 1 }, { table: 2, seat: 2 }], 2, 2)).toEqual([{ table: 1, seat: 2 }, { table: 2, seat: 1 }]);
  });

  it('makes a full room an alternate, and ignores seats outside the room', () => {
    expect(eligibleSeats([{ table: 1, seat: 1 }, { table: 1, seat: 2 }], 1, 2)).toEqual([]);
    expect(eligibleSeats([{ table: 3, seat: 1 }], 1, 2)).toEqual([{ table: 1, seat: 1 }, { table: 1, seat: 2 }]);
  });

  it('prompts moves only when tables are two or more apart, from the fullest to the emptiest', () => {
    expect(balancingMoves([8, 8, 8, 7])).toEqual([]);
    expect(balancingMoves([7, 5])).toEqual([{ from: 1, to: 2 }]);
    expect(balancingMoves([])).toEqual([]);
  });

  it('gives each bust its place among the runs, and the average stack', () => {
    expect(finishPlace(58, 1)).toBe(58);
    expect(finishPlace(3, 3)).toBe(1);
    expect(() => finishPlace(3, 0)).toThrow(RangeError);
    expect(averageStack(58 * 30_000, 31)).toBe(56_129);
  });
});

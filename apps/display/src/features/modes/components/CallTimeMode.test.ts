import type { TvCallTimeTable } from '@rivr/db';
import { fromPaise } from '@rivr/domain/money';
import { describe, expect, it } from 'vitest';
import { toSeats } from './CallTimeMode.tsx';

// 100/200 with no straddle, but the Private Room, which has one of 500.
const FIGURES = { game: 'nlh' as const, smallBlind: fromPaise(10_000n), bigBlind: fromPaise(20_000n), straddle: null };

const TABLES: TvCallTimeTable[] = [
  {
    tableId: 't3', name: 'Table 3', stake: 'NLH 100/200', ...FIGURES,
    seated: [
      { seat: 2, name: 'Vihaan K.', callTimeLeft: 3900, isAway: false, isLeaving: false },
      { seat: 5, name: 'Kabir S.', callTimeLeft: 1500, isAway: false, isLeaving: true },
      { seat: 6, name: 'Rohan B.', callTimeLeft: 0, isAway: false, isLeaving: false },
      { seat: 7, name: null, callTimeLeft: 600, isAway: true, isLeaving: false },
    ],
  },
  { tableId: 't1', name: 'Table 1', stake: 'NLH 50/100', ...FIGURES, seated: [{ seat: 1, name: 'Dev M.', callTimeLeft: null, isAway: false, isLeaving: true }] },
  { tableId: 'pr', name: 'Private Room', stake: 'Private Room', ...FIGURES, straddle: fromPaise(50_000n), seated: [{ seat: 1, name: 'Ishaan V.', callTimeLeft: 7200, isAway: false, isLeaving: false }] },
];

describe('the call-time board (decision 0163), Seats opening on the TV', () => {
  it('lists every seat on call time soonest first, in the one form for a length of time, a hidden name as the seat', () => {
    expect(toSeats(TABLES, 0).map((seat) => [seat.where, seat.name, seat.time])).toEqual([
      ['Table 1 · seat 1', 'Dev M.', 'Now'],
      ['Table 3 · seat 7', '', 'Away'],
      ['Table 3 · seat 5', 'Kabir S.', '25 min'],
      ['Table 3 · seat 2', 'Vihaan K.', '1 h 5 min'],
      ['Private Room · seat 1', 'Ishaan V.', '2 h'],
    ]);
  });

  it('leaves out a player whose call time is done and who is not leaving', () => {
    expect(toSeats(TABLES, 0).some((seat) => seat.name === 'Rohan B.')).toBe(false);
  });

  it('counts down from when the board was read, a leaving player\'s seat opening now once their call time is done', () => {
    const later = toSeats(TABLES, 1500);
    expect(later.find((seat) => seat.name === 'Kabir S.')?.time).toBe('Now');
    expect(later.find((seat) => seat.name === 'Vihaan K.')?.time).toBe('40 min');
    // Away, the clock stands still.
    expect(later.find((seat) => seat.where === 'Table 3 · seat 7')?.time).toBe('Away');
  });
});

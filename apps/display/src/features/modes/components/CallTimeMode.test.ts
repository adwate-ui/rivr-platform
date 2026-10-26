import type { TvCallTimeTable } from '@rivr/db';
import { describe, expect, it } from 'vitest';
import { toGroups, toOpenings } from './CallTimeMode.tsx';

const TABLES: TvCallTimeTable[] = [
  {
    tableId: 't3', name: 'Table 3', stake: 'NLH 100/200',
    seated: [
      { seat: 2, name: 'Vihaan K.', callTimeLeft: 3600, isAway: false, isLeaving: false },
      { seat: 5, name: 'Kabir S.', callTimeLeft: 1500, isAway: false, isLeaving: true },
      { seat: 6, name: 'Rohan B.', callTimeLeft: 0, isAway: false, isLeaving: false },
      { seat: 7, name: null, callTimeLeft: 600, isAway: true, isLeaving: false },
    ],
  },
  { tableId: 't1', name: 'Table 1', stake: 'NLH 50/100', seated: [{ seat: 1, name: 'Dev M.', callTimeLeft: null, isAway: false, isLeaving: true }] },
  { tableId: 'pr', name: 'Private Room', stake: 'Private Room', seated: [{ seat: 1, name: 'Ishaan V.', callTimeLeft: 7200, isAway: false, isLeaving: false }] },
];

describe('the call-time board (decision 0163)', () => {
  it('opens the leaving players\' seats soonest first, now where no call time is owed', () => {
    expect(toOpenings(TABLES, 0).map((opening) => [opening.where, opening.name, opening.time, opening.isNow])).toEqual([
      ['Table 1 · Seat 1', 'Dev M.', 'Now', true],
      ['Table 3 · Seat 5', 'Kabir S.', 'In 25 min', false],
    ]);
  });

  it('counts down from when the board was read', () => {
    expect(toOpenings(TABLES, 1500).find((opening) => opening.name === 'Kabir S.')).toMatchObject({ time: 'Now', isNow: true });
    expect(toGroups(TABLES, 60)[0]?.rows.map((row) => row.time)).toEqual(['10 min, away', '59 min']);
  });

  it('lists each table\'s players still on call time and not leaving, soonest first, a hidden name as the seat', () => {
    expect(toGroups(TABLES, 0).map((group) => [group.name, group.rows.map((row) => [row.seat, row.name, row.time])])).toEqual([
      ['Table 3', [['7', 'Seat 7', '10 min, away'], ['2', 'Vihaan K.', '1 h']]],
      ['Private Room', [['1', 'Ishaan V.', '2 h']]],
    ]);
  });
});

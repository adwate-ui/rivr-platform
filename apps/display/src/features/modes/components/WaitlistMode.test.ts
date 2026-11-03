import type { TvTableList } from '@rivr/db';
import { fromPaise } from '@rivr/domain/money';
import { describe, expect, it } from 'vitest';
import { toBoardColumn } from './WaitlistMode.tsx';

const STAKE = { stake: 'NLH 100/200', smallBlind: fromPaise(10_000n), bigBlind: fromPaise(20_000n) };

describe('the waitlist board, a list a table (decision 0433)', () => {
  it('heads each column with the table, its stake under it, and its places in order', () => {
    const table: TvTableList = {
      tableId: 't2', name: 'Table 2', ...STAKE, isOpen: true,
      places: [{ place: 1, name: 'Kabir S.', calledTo: 'Table 2', isAway: false }, { place: 2, name: null, calledTo: null, isAway: true }],
    };
    expect(toBoardColumn(table)).toEqual({
      id: 't2', stake: 'Table 2', detail: 'NLH 100/200',
      places: [
        { id: 't2-1', place: '1', name: 'Kabir S.', status: 'Called to Table 2' },
        { id: 't2-2', place: '2', name: 'Player 2', status: 'Away' },
      ],
    });
  });

  it('says a closed table somebody waits for is closed', () => {
    expect(toBoardColumn({ tableId: 't4', name: 'Table 4', ...STAKE, isOpen: false, places: [] }).detail).toBe('NLH 100/200 · Closed');
  });
});

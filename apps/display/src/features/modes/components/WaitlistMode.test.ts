import type { TvTableList } from '@rivr/db';
import { fromPaise } from '@rivr/domain/money';
import { describe, expect, it } from 'vitest';
import { tablesWithList, toBoardColumn } from './WaitlistMode.tsx';

const STAKE = { stake: 'NLH 100/200', game: 'nlh', smallBlind: fromPaise(10_000n), bigBlind: fromPaise(20_000n), straddle: null };

describe('the waitlist board, a list a table (decision 0467)', () => {
  it('heads each column with the table, its stake under it, and its places in order', () => {
    const table: TvTableList = {
      tableId: 't2', name: 'Table 2', ...STAKE, isOpen: true,
      places: [{ place: 1, name: 'Kabir S.', calledTo: 'Table 2', isAway: false }, { place: 2, name: null, calledTo: null, isAway: true }],
    };
    expect(toBoardColumn(table)).toEqual({
      id: 't2', stake: 'Table 2', detail: 'NLH 100/200',
      places: [
        { id: 't2-1', place: '1', name: 'Kabir S.', status: 'Called to Table 2' },
        { id: 't2-2', place: '2', name: '', status: 'Away' },
      ],
    });
  });

  it('writes a stake with its straddle, after a name that is its own (issue 990)', () => {
    const straddle = fromPaise(50_000n);
    expect(toBoardColumn({ tableId: 't4', name: 'Table 4', ...STAKE, straddle, isOpen: true, places: [] }).detail).toBe('NLH 100/200/500');
    expect(toBoardColumn({ tableId: 'pr', name: 'Private Room', ...STAKE, stake: 'Private Room', straddle, isOpen: false, places: [] }).detail)
      .toBe('Private Room · NLH 100/200/500 · Closed');
  });

  it('says a closed table somebody waits for is closed', () => {
    expect(toBoardColumn({ tableId: 't4', name: 'Table 4', ...STAKE, isOpen: false, places: [] }).detail).toBe('NLH 100/200 · Closed');
  });

  it('gives a column only to a table with a list, in the floor\'s order; the rest are not on the board (redesign RD-28)', () => {
    const place = { place: 1, name: 'Kabir S.', calledTo: null, isAway: false };
    const tables: TvTableList[] = ['Table 1', 'Table 2', 'Table 4', 'Private Room'].map((name, index) => ({
      tableId: `t${index}`, name, ...STAKE, isOpen: true, places: name === 'Table 2' || name === 'Private Room' ? [place] : [],
    }));
    expect(tablesWithList(tables).map((table) => table.name)).toEqual(['Table 2', 'Private Room']);
  });
});

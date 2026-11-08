import type { TvTableList } from '@rivr/db';
import { fromPaise } from '@rivr/domain/money';
import { describe, expect, it } from 'vitest';
import { arrangeTables, footerOf, toBoardColumn } from './WaitlistMode.tsx';

const STAKE = { stake: 'NLH 100/200', smallBlind: fromPaise(10_000n), bigBlind: fromPaise(20_000n) };

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

  it('says a closed table somebody waits for is closed', () => {
    expect(toBoardColumn({ tableId: 't4', name: 'Table 4', ...STAKE, isOpen: false, places: [] }).detail).toBe('NLH 100/200 · Closed');
  });

  it('gives a column only to a table with a list, in order, and names the rest (F-140)', () => {
    const place = { place: 1, name: 'Kabir S.', calledTo: null, isAway: false };
    const tables: TvTableList[] = ['Table 1', 'Table 2', 'Table 4'].map((name, index) => ({ tableId: `t${index}`, name, ...STAKE, isOpen: true, places: name === 'Table 2' ? [place] : [] }));
    const { withList, noList } = arrangeTables(tables);
    expect(withList.map((table) => table.name)).toEqual(['Table 2']);
    expect(noList).toEqual(['Table 1', 'Table 4']);
  });

  it('says at the foot which page and which tables have no list, whichever there are (F-140)', () => {
    expect(footerOf(0, 2, ['Table 4', 'Table 5'])).toBe('Page 1 of 2 · Table 4, Table 5: no list');
    expect(footerOf(1, 2, [])).toBe('Page 2 of 2');
    expect(footerOf(0, 1, ['Table 4'])).toBe('Table 4: no list');
    expect(footerOf(0, 1, [])).toBeUndefined();
  });
});

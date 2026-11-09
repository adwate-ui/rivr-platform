import { describe, expect, it } from 'vitest';
import { seatingCallTime, tableToSeatAt, tableWithRoomFor, type TableWithRoom } from './index.ts';

const table = (name: string, isOpen: boolean, openSeats: number, waiting: number) => ({ name, isOpen, openSeats, waiting });

describe('where Seat a player seats (decision 0479)', () => {
  it('picks the first open table with a free seat and someone waiting', () => {
    const tables = [table('Table 1', true, 2, 0), table('Table 2', true, 0, 4), table('Table 3', true, 1, 2), table('Table 5', true, 3, 1)];
    expect(tableToSeatAt(tables)?.name).toBe('Table 3');
  });

  it('passes over a closed table, however many wait for it', () => {
    expect(tableToSeatAt([table('Table 4', false, 9, 3), table('Table 5', true, 1, 1)])?.name).toBe('Table 5');
  });

  it('takes the first open table with a free seat when nobody waits', () => {
    expect(tableToSeatAt([table('Table 1', true, 0, 0), table('Table 2', true, 2, 0), table('Table 3', true, 5, 0)])?.name).toBe('Table 2');
  });

  it('finds none when every table is closed or full', () => {
    expect(tableToSeatAt([table('Table 1', true, 0, 2), table('Table 4', false, 9, 0)])).toBeNull();
    expect(tableToSeatAt([])).toBeNull();
  });
});

describe('the call time Seat a player starts with (decision 0299)', () => {
  it('is the stake\'s own where the floor picks it, else 3 hours', () => {
    expect([180, 240, 300].map(seatingCallTime)).toEqual([180, 240, 300]);
    expect([0, 120, 360].map(seatingCallTime)).toEqual([180, 180, 180]);
  });
});

describe('tableWithRoomFor (audit F-036)', () => {
  const FULL: TableWithRoom = { id: 't', tableTypeId: 'a', isOpen: true, openSeats: 0, waiting: 0, mustMoveToTableId: null };
  const other = (id: string, extra: Partial<TableWithRoom> = {}): TableWithRoom => ({ ...FULL, id, ...extra });

  it('names the open table at the same stake with the most seats free', () => {
    expect(tableWithRoomFor(FULL, [FULL, other('b', { openSeats: 2 }), other('c', { openSeats: 6 })])?.id).toBe('c');
  });

  it('names none while the list\'s own table has a seat', () => {
    expect(tableWithRoomFor(other('t', { openSeats: 1 }), [other('b', { openSeats: 6 })])).toBeNull();
  });

  it('skips another stake, a closed table and a full one', () => {
    expect(tableWithRoomFor(FULL, [other('b', { tableTypeId: 'z', openSeats: 6 }), other('c', { isOpen: false, openSeats: 6 }), other('d'), other('e', { openSeats: null })])).toBeNull();
  });

  it('counts only the seats its own list has no claim to', () => {
    expect(tableWithRoomFor(FULL, [other('b', { openSeats: 2, waiting: 5 }), other('c', { openSeats: 2, waiting: 2 })])).toBeNull();
    expect(tableWithRoomFor(FULL, [other('b', { openSeats: 6, waiting: 5 }), other('c', { openSeats: 3, waiting: 0 })])?.id).toBe('c');
  });

  it('skips a main table a running must-move table feeds', () => {
    expect(tableWithRoomFor(FULL, [other('b', { openSeats: 6 }), other('f', { mustMoveToTableId: 'b' })])).toBeNull();
  });

  it('still points a closed table\'s list at one running', () => {
    expect(tableWithRoomFor(other('t', { isOpen: false }), [other('b', { openSeats: 3 })])?.id).toBe('b');
  });
});

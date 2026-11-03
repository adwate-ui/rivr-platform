import { describe, expect, it } from 'vitest';
import { tableToSeatAt } from './index.ts';

const table = (name: string, isOpen: boolean, openSeats: number, waiting: number) => ({ name, isOpen, openSeats, waiting });

describe('where Seat a player seats (decision 0446)', () => {
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

import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { Money } from '../Money/Money.tsx';
import type { DataTableColumn } from './columns.ts';
import { filteredColumns, filterKindOf } from './filterKind.ts';

interface Player {
  readonly name: string;
  readonly tier: string;
  readonly visits: number;
  readonly status: string;
  readonly rank: number;
  readonly joined: string;
  readonly balance: bigint;
  readonly tables: readonly string[];
}

const PLAYERS: readonly Player[] = [
  { name: 'Asha Verma', tier: 'Member', visits: 1250, status: 'Seated', rank: 2, joined: '2026-11-01T20:00:00+05:30', balance: 150000n, tables: ['Table 1'] },
  { name: 'Ravi Kumar', tier: 'Founders', visits: 3, status: 'Waiting', rank: 1, joined: '2026-10-02T20:00:00+05:30', balance: 0n, tables: ['Table 1', 'Table 2'] },
  { name: 'Meera Iyer', tier: 'Member', visits: 0, status: 'Seated', rank: 2, joined: '2026-09-12T20:00:00+05:30', balance: 2500n, tables: [] },
];

const column = (key: keyof Player, more: Partial<DataTableColumn<Player>> = {}): DataTableColumn<Player> => ({
  key, header: key, cell: (row) => String(row[key]), ...more,
});

describe('filterKindOf', () => {
  it('reads words as a choice when few values repeat, else as words to type', () => {
    expect(filterKindOf(column('tier'), PLAYERS)).toBe('choice');
    expect(filterKindOf(column('name'), PLAYERS)).toBe('text');
  });

  it('reads a figure shown as it sorts as a number, commas aside', () => {
    expect(filterKindOf(column('visits', { cell: (row) => row.visits.toLocaleString('en-IN'), sortValue: (row) => row.visits }), PLAYERS)).toBe('number');
  });

  it('reads a sort by rank whose cell shows words as words: a status is a choice', () => {
    expect(filterKindOf(column('status', { sortValue: (row) => row.rank }), PLAYERS)).toBe('choice');
  });

  it('never reads a column of wordless cells sorted by rank as a number, as a status dot is: its export words decide', () => {
    const dot = column('status', { cell: (row) => createElement('span', { 'aria-label': row.status }), sortValue: (row) => row.rank, exportValue: (row) => row.status });
    expect(filterKindOf(dot, PLAYERS)).toBe('choice');
  });

  it('reads a sort by moments as a date, and a Money cell as a number', () => {
    expect(filterKindOf(column('joined', { cell: () => 'Nov 2026', sortValue: (row) => row.joined }), PLAYERS)).toBe('date');
    expect(filterKindOf(column('balance', { cell: (row) => createElement(Money, { paise: row.balance }) }), PLAYERS)).toBe('number');
  });

  it('reads several values a row as a choice', () => {
    expect(filterKindOf(column('tables', { cell: (row) => row.tables.join(', '), filterValue: (row) => row.tables }), PLAYERS)).toBe('choice');
  });

  it('takes the kind a column says, none for false or no heading, and words before the rows come', () => {
    expect(filterKindOf(column('visits', { filter: 'duration' }), PLAYERS)).toBe('duration');
    expect(filterKindOf(column('name', { filter: false }), PLAYERS)).toBeNull();
    expect(filterKindOf(column('name', { header: '' }), PLAYERS)).toBeNull();
    expect(filterKindOf(column('tier'), [])).toBe('text');
  });

  it('lists every filtered column with its kind, in order', () => {
    const columns = [column('name'), column('tier'), column('name', { key: 'actions', header: '' })];
    expect(filteredColumns(columns, PLAYERS).map(({ column: one, kind }) => `${one.key}:${kind}`)).toEqual(['name:text', 'tier:choice']);
  });
});

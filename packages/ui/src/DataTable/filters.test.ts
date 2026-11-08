import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { Money } from '../Money/Money.tsx';
import type { DataTableColumn } from './columns.ts';
import { choicesOf, filtersInWords, filtersOn, indiaDayOf, isOn, passes, presetDays, shiftDay, type ColumnFilters, type FilterClock, type FilteredColumn } from './filters.ts';

interface Visit {
  readonly name: string;
  readonly tier: string;
  readonly played: number;
  readonly at: string;
  readonly spent: bigint;
}

const VISITS: readonly Visit[] = [
  { name: 'Asha Verma', tier: 'Member', played: 2 * 3600, at: '2026-11-08T21:00:00+05:30', spent: 500000n },
  { name: 'Ravi Kumar', tier: 'Founders', played: 5 * 3600, at: '2026-11-02T03:00:00+05:30', spent: 1500000n },
  { name: 'Meera Iyer', tier: 'Member', played: 30 * 60, at: '2026-10-20T21:00:00+05:30', spent: 0n },
];

const on = (key: keyof Visit, kind: FilteredColumn<Visit>['kind'], more: Partial<DataTableColumn<Visit>> = {}): FilteredColumn<Visit> => ({
  column: { key, header: key[0]?.toUpperCase() + key.slice(1), cell: (row) => String(row[key]), ...more }, kind,
});

const NAME = on('name', 'text');
const TIER = on('tier', 'choice');
const PLAYED = on('played', 'duration', { sortValue: (row) => row.played });
const AT = on('at', 'date', { sortValue: (row) => row.at });
const SPENT = on('spent', 'number', { cell: (row) => createElement(Money, { paise: row.spent }) });
const COLUMNS = [NAME, TIER, PLAYED, AT, SPENT];
// 9 Nov 2026, the club's day from 06:00: the 2 Nov 03:00 visit is on 1 Nov's club day.
const CLOCK: FilterClock = { today: '2026-11-09', dayOf: (at) => indiaDayOf(new Date(at.getTime() - 6 * 3600 * 1000)) };

const names = (filters: ColumnFilters): readonly string[] =>
  VISITS.filter((row) => passes(row, filtersOn(COLUMNS, filters), filters, CLOCK)).map((row) => row.name);

describe('column filters', () => {
  it('keeps rows whose words contain what is typed, case aside', () => {
    expect(names({ name: { kind: 'text', typed: ' ravi ' } })).toEqual(['Ravi Kumar']);
  });

  it('keeps rows holding any value chosen, and counts each value', () => {
    expect(names({ tier: { kind: 'choice', chosen: ['Member'] } })).toEqual(['Asha Verma', 'Meera Iyer']);
    expect(choicesOf(TIER.column, VISITS)).toEqual([{ value: 'Founders', count: 1 }, { value: 'Member', count: 2 }]);
  });

  it('keeps durations in hours from and to, either left open', () => {
    expect(names({ played: { kind: 'range', min: '1', max: '' } })).toEqual(['Asha Verma', 'Ravi Kumar']);
    expect(names({ played: { kind: 'range', min: '', max: '2' } })).toEqual(['Asha Verma', 'Meera Iyer']);
  });

  it('reads a Money cell in rupees, commas aside', () => {
    expect(names({ spent: { kind: 'range', min: '5,000', max: '10000' } })).toEqual(['Asha Verma']);
  });

  it('keeps days by preset and by from and to, on the club day', () => {
    expect(names({ at: { kind: 'date', preset: 'last7' } })).toEqual(['Asha Verma']);
    expect(names({ at: { kind: 'date', preset: 'thisMonth' } })).toEqual(['Asha Verma', 'Ravi Kumar']);
    expect(names({ at: { kind: 'dateRange', from: '2026-10-01', to: '2026-11-01' } })).toEqual(['Ravi Kumar', 'Meera Iyer']);
    expect(presetDays('last30', '2026-11-09')).toEqual({ from: '2026-10-11', to: '2026-11-09' });
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('holds every filter in force; one asking nothing, or not fitting its column, is not in force', () => {
    expect(names({ tier: { kind: 'choice', chosen: ['Member'] }, played: { kind: 'range', min: '1', max: '' } })).toEqual(['Asha Verma']);
    expect(isOn({ kind: 'range', min: 'abc', max: ' ' })).toBe(false);
    expect(filtersOn(COLUMNS, { played: { kind: 'text', typed: '2' } })).toEqual([]);
  });

  it('says each filter in words, as a pill and an export do', () => {
    const filters: ColumnFilters = {
      name: { kind: 'text', typed: 'ravi' }, tier: { kind: 'choice', chosen: ['Member', 'Founders'] },
      played: { kind: 'range', min: '2', max: '' }, at: { kind: 'dateRange', from: '2026-11-02', to: '2026-11-08' },
      spent: { kind: 'range', min: '', max: '500' },
    };
    expect(filtersInWords(filtersOn(COLUMNS, filters), filters)).toEqual([
      'Name: ravi', 'Tier: Member or Founders', 'Played: at least 2 h', 'At: 2 Nov 2026 to 8 Nov 2026', 'Spent: at most 500',
    ]);
    expect(filtersInWords([AT], { at: { kind: 'date', preset: 'last7' } })).toEqual(['At: Last 7 days']);
  });
});

import { t } from '@rivr/i18n';
import type { DataTableColumn } from './columns.ts';
import { textOf } from './DataTableExport.tsx';

/** One column's filter in force (owner, 8 Nov: filters on every table): the words typed, or the values chosen. */
export interface ColumnFilter {
  readonly typed: string;
  readonly chosen: readonly string[];
}

/** Each filtered column's filter, by the column's key. */
export type ColumnFilters = Readonly<Record<string, ColumnFilter>>;

export const NO_FILTERS: ColumnFilters = {};

const COLLATOR = new Intl.Collator('en-IN', { sensitivity: 'base', numeric: true });

/** A row's value as its column's filter reads it: the column's own filter value, else the words its cell shows. */
export function filterValueOf<Row>(column: DataTableColumn<Row>, row: Row): string {
  return column.filterValue?.(row) ?? textOf(column.cell(row));
}

const isOn = (filter: ColumnFilter | undefined): filter is ColumnFilter => filter !== undefined && (filter.typed.trim() !== '' || filter.chosen.length > 0);

/** The columns with a filter in force, in the table's order. */
export function filtersOn<Row>(columns: readonly DataTableColumn<Row>[], filters: ColumnFilters): readonly DataTableColumn<Row>[] {
  return columns.filter((column) => column.filter !== undefined && isOn(filters[column.key]));
}

/** Whether a row holds every filter in force: the words typed within its value, or its value among those chosen. */
export function passes<Row>(row: Row, on: readonly DataTableColumn<Row>[], filters: ColumnFilters): boolean {
  return on.every((column) => {
    const filter = filters[column.key];
    if (filter === undefined) return true;
    const value = filterValueOf(column, row);
    return column.filter === 'choice' ? filter.chosen.includes(value) : value.toLowerCase().includes(filter.typed.trim().toLowerCase());
  });
}

/** A choice column's values among the rows, in order, each with how many rows hold it; a blank value is no choice. */
export function choicesOf<Row>(column: DataTableColumn<Row>, rows: readonly Row[]): readonly { readonly value: string; readonly count: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = filterValueOf(column, row);
    if (value !== '') counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts].sort(([one], [other]) => COLLATOR.compare(one, other)).map(([value, count]) => ({ value, count }));
}

/** The filters in force in words, as an export records them: `Role: Admin or Cashier`, `Member: ravi`. */
export function filtersInWords<Row>(on: readonly DataTableColumn<Row>[], filters: ColumnFilters): readonly string[] {
  return on.map((column) => {
    const filter = filters[column.key];
    const value = column.filter === 'choice' ? (filter?.chosen ?? []).join(t('ui.dataTable.or')) : (filter?.typed ?? '').trim();
    return t('ui.dataTable.filterInForce', { label: column.header, value });
  });
}

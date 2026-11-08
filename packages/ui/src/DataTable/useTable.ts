import { useMemo } from 'react';
import type { DataTableColumn, DataTableSort } from './columns.ts';
import { useDayOf, useTableView } from './DataTableView.tsx';
import { filteredColumns } from './filterKind.ts';
import { filtersOn, NO_FILTERS, passes, type ColumnFilter, type ColumnFilters, type FilteredColumn } from './filters.ts';

/**
 * A table's search box: its label, its look (`subtle`, the label inside a filled box, as on Members), and what a row is
 * matched by (`text`, contained; or the screen's own `matches`).
 */
export type DataTableSearch<Row> = { readonly label: string; readonly variant?: 'subtle' | undefined } & (
  | { readonly text: (row: Row) => string }
  | { readonly matches: (row: Row, query: string) => boolean }
);

/** What useTable reads of the table's props. */
interface TableInput<Row> {
  readonly label: string;
  readonly columns: readonly DataTableColumn<Row>[];
  readonly initialSort?: DataTableSort | undefined;
  readonly filter?: DataTableSearch<Row> | undefined;
  readonly status?: 'ready' | 'loading' | 'error' | undefined;
  readonly rows?: readonly Row[] | undefined;
}

// One collator for every comparison: making one per comparison is slow on thousands of rows.
const COLLATOR = new Intl.Collator('en-IN', { sensitivity: 'base', numeric: true });
const NO_ROWS: readonly never[] = [];

function compare(a: string | number | bigint, b: string | number | bigint): number {
  if (typeof a === 'string' && typeof b === 'string') return COLLATOR.compare(a, b);
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

/** Whether a row is found by the words searched, trimmed and in lower case: by the screen's own match, or within its text. */
function matcherOf<Row>(search: DataTableSearch<Row> | undefined): ((row: Row, needle: string) => boolean) | undefined {
  if (search === undefined) return undefined;
  if ('matches' in search) return search.matches;
  return (row, needle) => search.text(row).toLowerCase().includes(needle);
}

interface View<Row> {
  readonly columns: readonly DataTableColumn<Row>[];
  readonly on: readonly FilteredColumn<Row>[];
  readonly sort: DataTableSort | null;
  readonly matches: ((row: Row, needle: string) => boolean) | undefined;
  readonly query: string;
  readonly filters: ColumnFilters;
  readonly dayOf: (at: Date) => string;
}

/** The rows to show: those the search finds and every column filter in force holds, in the chosen order. */
function shown<Row>(rows: readonly Row[], { columns, on, sort, matches, query, filters, dayOf }: View<Row>): readonly Row[] {
  const needle = query.trim().toLowerCase();
  // Today is read with the rows, so a table left open past midnight counts its days from the new one.
  const clock = { today: dayOf(new Date()), dayOf };
  const matching = rows.filter((row) => (matches === undefined || needle === '' || matches(row, needle)) && passes(row, on, filters, clock));
  const value = columns.find((column) => column.key === sort?.key)?.sortValue;
  if (sort === null || value === undefined) return matching;
  const sign = sort.direction === 'ascending' ? 1 : -1;
  return [...matching].sort((a, b) => sign * compare(value(a), value(b)));
}

/** The table's view and the rows it shows, and how each part of the view changes. */
export function useTable<Row>(props: TableInput<Row>) {
  const [view, setView, flush] = useTableView(props.label, props.initialSort ?? null);
  const dayOf = useDayOf();
  const source = props.status === 'loading' || props.status === 'error' || props.rows === undefined ? NO_ROWS : props.rows;
  const filtered = useMemo(() => filteredColumns(props.columns, source), [props.columns, source]);
  const on = useMemo(() => filtersOn(filtered, view.filters), [filtered, view.filters]);
  const matches = matcherOf(props.filter);
  const visible = useMemo(() => shown(source, { columns: props.columns, on, sort: view.sort, matches, query: view.query, filters: view.filters, dayOf }),
    [source, props.columns, on, view.sort, matches, view.query, view.filters, dayOf]);
  const setFilter = (key: string, filter: ColumnFilter | undefined, isTyping = false) => {
    const rest = Object.fromEntries(Object.entries(view.filters).filter(([one]) => one !== key));
    setView({ ...view, filters: filter === undefined ? rest : { ...rest, [key]: filter } }, isTyping);
  };
  const toggleSort = (key: string) =>
    setView({ ...view, sort: view.sort?.key === key && view.sort.direction === 'ascending' ? { key, direction: 'descending' } : { key, direction: 'ascending' } });
  return {
    view, source, filtered, on, visible, setFilter, toggleSort, flush,
    setSort: (sort: DataTableSort) => setView({ ...view, sort }),
    setQuery: (query: string) => setView({ ...view, query }, true),
    clearAll: () => setView({ ...view, query: '', filters: NO_FILTERS }),
  };
}

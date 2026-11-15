import { useMemo, useRef } from 'react';
import type { DataTableColumn, DataTableSort } from './columns.ts';
import { useDayOf, useTableView } from './DataTableView.tsx';
import { filteredColumns } from './filterKind.ts';
import { filtersOn, NO_FILTERS, passes, type ColumnFilter, type ColumnFilters, type FilteredColumn } from './filters.ts';
import { useServerPages, type DataTableServer } from './server.ts';
import type { TableView } from './tableView.ts';

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
  readonly server?: DataTableServer | undefined;
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

/** How each part of the view changes; any change but the page's starts again from the first page. */
function changesOf(view: TableView, change: (next: TableView, isTyping?: boolean) => void) {
  const { sort, query, filters } = view;
  return {
    setFilter: (key: string, filter: ColumnFilter | undefined, isTyping = false) => {
      const rest = Object.fromEntries(Object.entries(filters).filter(([one]) => one !== key));
      change({ sort, query, filters: filter === undefined ? rest : { ...rest, [key]: filter } }, isTyping);
    },
    toggleSort: (key: string) =>
      change({ query, filters, sort: sort?.key === key && sort.direction === 'ascending' ? { key, direction: 'descending' } : { key, direction: 'ascending' } }),
    setSort: (next: DataTableSort) => change({ sort: next, query, filters }),
    setQuery: (next: string) => change({ sort, query: next, filters }, true),
    clearAll: () => change({ sort, query: '', filters: NO_FILTERS }),
    setPage: (page: number) => change({ sort, query, filters, page }),
  };
}

/**
 * The table's view and the rows it shows, and how each part of the view changes. In server mode the rows are one page
 * as the screen gives it, drawn as they are, and the view is handed to the screen.
 */
export function useTable<Row>(props: TableInput<Row>) {
  const [view, setView, flush] = useTableView(props.label, props.initialSort ?? null);
  const dayOf = useDayOf();
  const isServer = props.server !== undefined;
  const isReady = props.status !== 'loading' && props.status !== 'error' && props.rows !== undefined;
  const source = isReady ? props.rows : NO_ROWS;
  // The rows a column's kind and a choice's counts are read from: all of them, or in server mode none, as it holds one page.
  const counted = isServer ? NO_ROWS : source;
  const filtered = useMemo(() => filteredColumns(props.columns, counted), [props.columns, counted]);
  const on = useMemo(() => filtersOn(filtered, view.filters), [filtered, view.filters]);
  const matches = matcherOf(props.filter);
  const visible = useMemo(() => (isServer ? source : shown(source, { columns: props.columns, on, sort: view.sort, matches, query: view.query, filters: view.filters, dayOf })),
    [isServer, source, props.columns, on, view.sort, matches, view.query, view.filters, dayOf]);
  // Words searched in a link to a table without a search box are not applied, so never said nor handed on.
  const query = props.filter === undefined ? '' : view.query.trim();
  const typed = useRef(false);
  const pages = useServerPages({ server: props.server, view, query, on, isReady, typed });
  const changes = changesOf(view, (next, isTyping = false) => {
    typed.current = isTyping;
    setView(next, isTyping);
  });
  return { view, source, counted, filtered, on, visible, query, isReady, flush, ...pages, ...changes };
}

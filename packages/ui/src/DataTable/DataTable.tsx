import { t } from '@rivr/i18n';
import { useMemo, useRef, useState, type ReactNode, type UIEvent } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../Button/Button.tsx';
import { PhoneSort } from './PhoneSort.tsx';
import { Input } from '../Input/Input.tsx';
import { useIsWide } from '../useIsWide/useIsWide.ts';
import { Text } from '../Text/Text.tsx';
import { useTableDensity } from './DataTableDensity.tsx';
import { ExportBar, useTableExporter } from './DataTableExport.tsx';
import { HeaderRow, layoutOf, PlainBody, VirtualBody } from './rows.tsx';
import { ticksFor, type DataTableSelection } from './Selection.tsx';
import type { DataTableColumn, DataTableSort } from './columns.ts';

export type { DataTableColumn, DataTableSelection, DataTableSort };

/** The rows, or one of the states every list has. */
export type DataTableState<Row> =
  | { status?: 'ready'; rows: readonly Row[]; /** When there are no rows at all, for example "No markers outstanding." */ emptyText: string }
  | { status: 'loading' }
  | { status: 'error'; /** What happened, then what to do. Defaults to the shared load error. */ errorText?: string; onRetry?: () => void };

export type DataTableProps<Row> = DataTableState<Row> & {
  /** What the table lists, read as its name: "Open markers". */
  label: string;
  columns: readonly DataTableColumn<Row>[];
  rowKey: (row: Row) => string;
  /** A filter box above the table: a row stays when `text` gives something containing what is typed, case aside. */
  filter?: { readonly label: string; readonly text: (row: Row) => string };
  initialSort?: DataTableSort;
  /** Beside the filter box, given the rows as shown (filtered and sorted). */
  toolbar?: (rows: readonly Row[]) => ReactNode;
  /** The screen's own filters, in words, which an export records with the table's (#102): `Search: 9000`. */
  exportFilter?: string;
  /**
   * Where the Export control goes in place of the table's top right: an element in the screen's title row, as the
   * Members prototype has it beside the title. Null while that element is not there yet, and nothing shows.
   */
  exportIn?: HTMLElement | null;
  /**
   * Opens a row's record: a click anywhere on the row does, besides on a control in it, and its title becomes the
   * button a keyboard and a screen reader open it with (#603).
   */
  onRowOpen?: (row: Row) => void;
  /** A first column of ticks, to act on several rows at once, with a tick in the header for every row as shown. */
  selection?: DataTableSelection;
  /**
   * A row's height from 1180 px: `comfortable`, 42 px, or `compact`, 34 px. Below, rows stay 44 px targets. Left out, the
   * staff member's own density from `DataTableDensityProvider` (decision 0475).
   */
  density?: 'comfortable' | 'compact';
  /**
   * Below 768 px: `cards`, a card per row, sorted from a bar above them; or `scroll`, the table's lines under its header,
   * scrolling sideways with the first column held.
   */
  narrowLayout?: 'cards' | 'scroll';
  /**
   * Under a row, across the whole table: what the row opened in place, such as a dealer's new PIN or a setting's new
   * value (console v3); null for none. Not in a long list, whose rows are all one height.
   */
  rowDetail?: (row: Row) => ReactNode;
};

/** Past this many rows, only the rows in view are drawn (additions, "Performance budgets"). */
export const VIRTUAL_FROM = 200;

// One collator for every comparison: making one per comparison is slow on thousands of rows.
const COLLATOR = new Intl.Collator('en-IN', { sensitivity: 'base', numeric: true });
const NO_ROWS: readonly never[] = [];

function compare(a: string | number | bigint, b: string | number | bigint): number {
  if (typeof a === 'string' && typeof b === 'string') return COLLATOR.compare(a, b);
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

interface View<Row> {
  readonly columns: readonly DataTableColumn<Row>[];
  readonly sort: DataTableSort | null;
  readonly text: ((row: Row) => string) | undefined;
  readonly query: string;
}

/** The rows to show: those matching the filter, in the chosen order. */
function shown<Row>(rows: readonly Row[], { columns, sort, text, query }: View<Row>): readonly Row[] {
  const needle = query.trim().toLowerCase();
  const matching = text === undefined || needle === '' ? rows : rows.filter((row) => text(row).toLowerCase().includes(needle));
  const value = columns.find((column) => column.key === sort?.key)?.sortValue;
  if (sort === null || value === undefined) return matching;
  const sign = sort.direction === 'ascending' ? 1 : -1;
  return [...matching].sort((a, b) => sign * compare(value(a), value(b)));
}

/** How many rows have their detail open: each is a row of its own, counted with the others. */
function detailCount<Row>(rows: readonly Row[], detail: ((row: Row) => ReactNode) | undefined): number {
  return detail === undefined ? 0 : rows.filter((row) => (detail(row) ?? null) !== null).length;
}

interface TableProps<Row> {
  readonly props: DataTableProps<Row>;
  readonly visible: readonly Row[];
  readonly sort: DataTableSort | null;
  readonly query: string;
  readonly onSort: (key: string) => void;
}

function Table<Row>({ props, visible, sort, query, onSort }: TableProps<Row>) {
  const header = useRef<HTMLDivElement>(null);
  // The staff member's own density (decision 0475), unless the table sets one.
  const density = useTableDensity();
  const isVirtual = visible.length > VIRTUAL_FROM;
  const ticks = props.selection === undefined ? null : ticksFor(props.selection, visible.map(props.rowKey));
  const layout = layoutOf(props.columns, props.narrowLayout ?? 'cards', props.density ?? density, ticks);
  // In the scroll layout below 768 px the body scrolls sideways, and the header, which has no scrollbar, follows it.
  const onScrollX = (event: UIEvent<HTMLElement>) => {
    if (header.current !== null) header.current.scrollLeft = event.currentTarget.scrollLeft;
  };
  const body = { rows: visible, columns: props.columns, rowKey: props.rowKey, onRowOpen: props.onRowOpen, layout, onScrollX };
  const detail = isVirtual ? undefined : props.rowDetail;
  return (
    <div role="table" aria-label={props.label} aria-rowcount={visible.length + detailCount(visible, detail) + 1} className="flex flex-col">
      <HeaderRow ref={header} columns={props.columns} sort={sort} onSort={onSort} layout={layout} isVirtual={isVirtual} />
      {isVirtual
        // A new order or filter starts from the top.
        ? <VirtualBody key={`${sort?.key ?? ''}:${sort?.direction ?? ''}:${query}`} {...body} />
        : <PlainBody {...body} rowDetail={detail} />}
    </div>
  );
}

/** What stands in for the rows: loading, the error with a retry, or why there are none (announced as the filter changes). */
function Instead<Row>({ props, query }: { props: DataTableProps<Row>; query: string }) {
  if (props.status === 'loading') return <div role="status" className="px-3 py-4"><Text tone="muted">{t('common.loading')}</Text></div>;
  if (props.status === 'error') {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 px-3 py-4">
        <Text>{props.errorText ?? t('common.loadFailed')}</Text>
        {props.onRetry ? <Button onClick={props.onRetry}>{t('common.retry')}</Button> : null}
      </div>
    );
  }
  const text = props.rows.length === 0 ? props.emptyText : t('ui.dataTable.noMatch', { query: query.trim() });
  return <div role="status" className="px-3 py-4"><Text tone="muted">{text}</Text></div>;
}

/** Every filter in force, in words, as an export records them: the screen's, then the table's own. */
function filtersInForce<Row>(props: DataTableProps<Row>, query: string): string {
  const typed = query.trim();
  const own = typed === '' || props.filter === undefined ? undefined : `${props.filter.label}: ${typed}`;
  return [props.exportFilter, own].filter((part) => part !== undefined && part !== '').join('; ');
}

/**
 * The Export control for the rows as shown, beneath a DataTableExportProvider and once there are rows: `here`, at the
 * table's top right, or `elsewhere`, drawn in the element `exportIn` names.
 */
function useExportPlaced<Row>(props: DataTableProps<Row>, visible: readonly Row[], query: string) {
  const exporter = useTableExporter();
  const menu = exporter === null || visible.length === 0 ? null
    : <ExportBar exporter={exporter} label={props.label} columns={props.columns} rows={visible} filter={filtersInForce(props, query)} />;
  const target = props.exportIn;
  if (target === undefined) return { here: menu, elsewhere: null };
  return { here: null, elsewhere: menu === null || target === null ? null : createPortal(menu, target) };
}

/**
 * Above the table: the filter box, the caller's toolbar, and, beneath a DataTableExportProvider, the Export control at
 * the top right for the rows as shown with every filter in force, or in the element `exportIn` names; nothing when there
 * is none of these.
 */
function Bar<Row>({ props, visible, query, onQuery }: { props: DataTableProps<Row>; visible: readonly Row[]; query: string; onQuery: (query: string) => void }) {
  const { here, elsewhere } = useExportPlaced(props, visible, query);
  if (props.filter === undefined && props.toolbar === undefined && here === null) return elsewhere;
  return (
    <div className="flex flex-wrap items-end gap-4">
      {props.filter === undefined ? null : (
        <div className="min-w-0 flex-1 basis-full medium:basis-0">
          <Input type="search" label={props.filter.label} value={query} onChange={(event) => onQuery(event.target.value)} autoComplete="off" />
        </div>
      )}
      {props.toolbar?.(visible)}
      {here}
      {elsewhere}
    </div>
  );
}

/**
 * A table of records for the console (`.claude/rules/ui.md`, "Data"): headers that sort, held at the top as the page
 * scrolls, an optional filter box, optional ticks, and the loading, empty and error states. Past 200 rows only the rows
 * in view are drawn, so thousands of rows scroll smoothly. Beneath a DataTableExportProvider, the rows as shown export
 * as CSV or XLSX, each export recorded first (#102).
 */
export function DataTable<Row>(props: DataTableProps<Row>) {
  const isWide = useIsWide('medium');
  const [sort, setSort] = useState<DataTableSort | null>(props.initialSort ?? null);
  const [query, setQuery] = useState('');
  const source = props.status === 'loading' || props.status === 'error' ? NO_ROWS : props.rows;
  const text = props.filter?.text;
  const visible = useMemo(() => shown(source, { columns: props.columns, sort, text, query }), [source, props.columns, sort, text, query]);
  const onSort = (key: string) => setSort((current) =>
    current?.key === key && current.direction === 'ascending' ? { key, direction: 'descending' } : { key, direction: 'ascending' });
  return (
    <div className="flex flex-col gap-4">
      <Bar props={props} visible={visible} query={query} onQuery={setQuery} />
      {visible.length === 0 ? <Instead props={props} query={query} /> : (
        <>
          {/* Below 768 px the cards sort from a bar above them; the scroll layout keeps its header. */}
          {isWide || props.narrowLayout === 'scroll' ? null : <PhoneSort label={props.label} columns={props.columns} sort={sort} onSort={onSort} />}
          <Table props={props} visible={visible} sort={sort} query={query} onSort={onSort} />
        </>
      )}
    </div>
  );
}

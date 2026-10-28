import { t } from '@rivr/i18n';
import { tokens } from '@rivr/tokens';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '../Button/Button.tsx';
import { Icon } from '../Icon/Icon.tsx';
import { Input } from '../Input/Input.tsx';
import { cx } from '../internal/classes.ts';
import { Text } from '../Text/Text.tsx';
import { ExportBar, useTableExporter } from './DataTableExport.tsx';

/** One column: its header, what each row shows in it, and the value it sorts by (no sorting without one). */
export interface DataTableColumn<Row> {
  readonly key: string;
  readonly header: string;
  readonly cell: (row: Row) => ReactNode;
  readonly sortValue?: (row: Row) => string | number | bigint;
  /** Figures and money line up at the end. */
  readonly align?: 'start' | 'end';
  /**
   * How a phone shows the column, where each row is a card (#603): `primary`, the card's title (the first column by
   * default); `secondary`, a line under it with the column's name; `optional`, left out below 768 px.
   */
  readonly priority?: 'primary' | 'secondary' | 'optional';
  /**
   * What an export gives for the column (#102). Without one: the cell's words, a Money cell's rupees, or the
   * sort value. A column with no heading, such as a row's buttons, is left out of exports.
   */
  readonly exportValue?: (row: Row) => string | number;
}

/** Which column the rows are sorted by, and which way. */
export interface DataTableSort {
  readonly key: string;
  readonly direction: 'ascending' | 'descending';
}

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
  /** Opens a row's record: its title becomes a button that does (#603). */
  onRowOpen?: (row: Row) => void;
};

/** Past this many rows, only the rows in view are drawn (additions, "Performance budgets"). */
export const VIRTUAL_FROM = 200;
const ROW_HEIGHT = tokens.space[12];
// A card below 768 px: each line this high, the gap between lines, the padding above and below, the hairline under it.
const CARD_LINE = tokens.space[6];
const CARD_GAP = tokens.space[1];
const CARD_PADDING = tokens.space[3] * 2;
const HAIRLINE = 1;
const ROWS_IN_VIEW = 12;
// Rows drawn beyond each edge of the view, so a quick scroll shows no gap.
const OVERSCAN = 6;
// From 768 px up a row is a line of equal columns; below, it is a card: its title, then a line for each other column.
const WIDE_GRID = 'medium:grid medium:grid-flow-col medium:auto-cols-fr medium:items-center medium:gap-4';

type Priority = NonNullable<DataTableColumn<unknown>['priority']>;

const priorityOf = (column: DataTableColumn<never>, index: number): Priority => column.priority ?? (index === 0 ? 'primary' : 'secondary');

// Below 768 px a secondary cell names its column before its value, from data-label (styles.css), so the header's words
// stay out of the rows.
const CELL: Record<Priority, string> = {
  primary: '',
  secondary: 'flex justify-between gap-3 text-14 medium:block medium:text-16',
  optional: 'hidden medium:block',
};

/**
 * A card's height below 768 px, for the drawn window of a long list: its title (a 44 px button when rows open), a line
 * for each secondary column, and what is between and around them. A long list's cells keep to one line, so it holds.
 */
function cardHeight<Row>(columns: readonly DataTableColumn<Row>[], opens: boolean): number {
  const secondary = columns.filter((column, index) => priorityOf(column, index) === 'secondary').length;
  return (opens ? tokens.size.touch : CARD_LINE) + secondary * (CARD_GAP + CARD_LINE) + CARD_PADDING + HAIRLINE;
}

/** Whether rows are lines (768 px and up) or cards; lines where the browser cannot say. */
function useIsWide(): boolean {
  const query = `(min-width: ${tokens.breakpoint.medium}px)`;
  const [isWide, setWide] = useState(() => typeof window.matchMedia !== 'function' || window.matchMedia(query).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const list = window.matchMedia(query);
    const onChange = () => setWide(list.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);
  return isWide;
}
// One collator for every comparison: making one per comparison is slow on thousands of rows.
const COLLATOR = new Intl.Collator('en-IN', { sensitivity: 'base', numeric: true });
const NO_ROWS: readonly never[] = [];
// A scrolling body and the header above it keep the same room for a scrollbar, so their columns line up.
const GUTTER = { scrollbarGutter: 'stable' } as const;

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

function HeaderCell<Row>({ column, sort, onSort }: { column: DataTableColumn<Row>; sort: DataTableSort | null; onSort: (key: string) => void }) {
  const direction = sort?.key === column.key ? sort.direction : undefined;
  const align = column.align === 'end' ? 'justify-end' : 'justify-start';
  if (column.sortValue === undefined) {
    return <div role="columnheader" className={cx('flex min-w-0', align)}><Text variant="small" tone="muted">{column.header}</Text></div>;
  }
  return (
    <div role="columnheader" aria-sort={direction ?? 'none'} className={cx('flex min-w-0', align)}>
      <button type="button" onClick={() => onSort(column.key)}
        className="flex min-h-touch items-center gap-1 font-text text-14 text-content-muted transition-colors hover:text-content focus-visible:text-content">
        {column.header}
        {direction === undefined ? null : <Icon name={direction === 'ascending' ? 'chevronUp' : 'chevronDown'} size="sm" />}
      </button>
    </div>
  );
}

interface BodyRowProps<Row> {
  row: Row;
  columns: readonly DataTableColumn<Row>[];
  index: number;
  /** In a long list: where the row is drawn, and its height. */
  place?: { readonly offset: number; readonly height: number };
  onRowOpen?: ((row: Row) => void) | undefined;
}

/** The title cell's content: a button that opens the row, when rows open. */
function Title<Row>({ row, column, onRowOpen }: { row: Row; column: DataTableColumn<Row>; onRowOpen: ((row: Row) => void) | undefined }) {
  if (onRowOpen === undefined) return <>{column.cell(row)}</>;
  return (
    <button type="button" onClick={() => onRowOpen(row)}
      className="flex min-h-touch w-full items-center text-start text-content underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus">
      <span className="truncate">{column.cell(row)}</span>
    </button>
  );
}

function BodyRow<Row>({ row, columns, index, place, onRowOpen }: BodyRowProps<Row>) {
  return (
    <div role="row" aria-rowindex={index + 2}
      className={cx('flex flex-col gap-1 border-b border-hairline px-3 py-3 medium:h-12 medium:py-0', WIDE_GRID,
        place === undefined ? 'relative' : 'absolute inset-x-0 top-0 overflow-hidden')}
      style={place === undefined ? undefined : { transform: `translateY(${place.offset}px)`, height: place.height }}>
      {columns.map((column, at) => {
        const priority = priorityOf(column, at);
        return (
          // Rows are one height from 768 px, and a long list's cards are too, so there a cell keeps to one line: long
          // text ends in an ellipsis. data-label is the column's name, which styles.css shows before the value on a phone.
          <div key={column.key} role="cell" data-label={priority === 'secondary' ? column.header : undefined}
            className={cx('min-w-0 font-text text-16 text-content', place === undefined ? 'medium:truncate' : 'truncate', CELL[priority],
              column.align === 'end' ? 'medium:text-end' : 'text-start')}>
            {priority === 'primary' ? <Title row={row} column={column} onRowOpen={onRowOpen} /> : column.cell(row)}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Past VIRTUAL_FROM rows: a scrolling body of a fixed height, which takes keyboard focus so arrow keys
 * scroll it. Rows are all one height, so the rows in view, and a few either side, follow from how far
 * it is scrolled; only those are drawn.
 */
interface VirtualBodyProps<Row> {
  rows: readonly Row[];
  columns: readonly DataTableColumn<Row>[];
  rowKey: (row: Row) => string;
  onRowOpen: ((row: Row) => void) | undefined;
}

function VirtualBody<Row>({ rows, columns, rowKey, onRowOpen }: VirtualBodyProps<Row>) {
  const [scrolled, setScrolled] = useState(0);
  // Lines from 768 px up; cards below, each of a fixed height for its columns.
  const height = useIsWide() ? ROW_HEIGHT : cardHeight(columns, onRowOpen !== undefined);
  const first = Math.max(0, Math.floor(scrolled / height) - OVERSCAN);
  const last = Math.min(rows.length, Math.ceil(scrolled / height) + ROWS_IN_VIEW + OVERSCAN);
  return (
    <div role="rowgroup" tabIndex={0} className="overflow-y-auto focus-visible:outline-2 focus-visible:outline-focus"
      style={{ ...GUTTER, height: ROW_HEIGHT * ROWS_IN_VIEW }} onScroll={(event) => setScrolled(event.currentTarget.scrollTop)}>
      <div className="relative w-full" style={{ height: rows.length * height }}>
        {rows.slice(first, last).map((row, index) => (
          <BodyRow key={rowKey(row)} row={row} columns={columns} index={first + index} place={{ offset: (first + index) * height, height }} onRowOpen={onRowOpen} />
        ))}
      </div>
    </div>
  );
}

function Table<Row>({ props, visible, sort, query, onSort }: { props: DataTableProps<Row>; visible: readonly Row[]; sort: DataTableSort | null; query: string; onSort: (key: string) => void }) {
  const isVirtual = visible.length > VIRTUAL_FROM;
  return (
    <div role="table" aria-label={props.label} aria-rowcount={visible.length + 1} className="flex flex-col">
      {/* The header shows from 768 px up; below, each card names its own columns. */}
      <div role="rowgroup" style={isVirtual ? { ...GUTTER, overflowY: 'hidden' } : undefined}>
        <div role="row" aria-rowindex={1} className={cx('hidden border-b border-hairline px-3', WIDE_GRID)}>
          {props.columns.map((column) => <HeaderCell key={column.key} column={column} sort={sort} onSort={onSort} />)}
        </div>
      </div>
      {isVirtual
        // A new order or filter starts from the top.
        ? <VirtualBody key={`${sort?.key ?? ''}:${sort?.direction ?? ''}:${query}`} rows={visible} columns={props.columns} rowKey={props.rowKey} onRowOpen={props.onRowOpen} />
        : <div role="rowgroup">{visible.map((row, index) => <BodyRow key={props.rowKey(row)} row={row} columns={props.columns} index={index} onRowOpen={props.onRowOpen} />)}</div>}
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
 * Above the table: the filter box, the caller's toolbar, and, beneath a DataTableExportProvider, the export
 * of the rows as shown with every filter in force; nothing when there is none of these.
 */
function Bar<Row>({ props, visible, query, onQuery }: { props: DataTableProps<Row>; visible: readonly Row[]; query: string; onQuery: (query: string) => void }) {
  const found = useTableExporter();
  const exporter = visible.length === 0 ? null : found;
  if (props.filter === undefined && props.toolbar === undefined && exporter === null) return null;
  return (
    <div className="flex flex-wrap items-end gap-4">
      {props.filter === undefined ? null : (
        <div className="min-w-0 flex-1 basis-full medium:basis-0">
          <Input type="search" label={props.filter.label} value={query} onChange={(event) => onQuery(event.target.value)} autoComplete="off" />
        </div>
      )}
      {props.toolbar?.(visible)}
      {exporter === null ? null : <ExportBar exporter={exporter} label={props.label} columns={props.columns} rows={visible} filter={filtersInForce(props, query)} />}
    </div>
  );
}

/**
 * A table of records for the console (`.claude/rules/ui.md`, "Data"): headers that sort, an optional
 * filter box, and the loading, empty and error states. Past 200 rows only the rows in view are drawn,
 * so thousands of rows scroll smoothly. Beneath a DataTableExportProvider, the rows as shown export as CSV
 * or XLSX, each export recorded first (#102).
 */
export function DataTable<Row>(props: DataTableProps<Row>) {
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
      {visible.length === 0 ? <Instead props={props} query={query} /> : <Table props={props} visible={visible} sort={sort} query={query} onSort={onSort} />}
    </div>
  );
}

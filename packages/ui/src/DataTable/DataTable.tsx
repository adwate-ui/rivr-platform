import { t } from '@rivr/i18n';
import { useRef, type ReactNode, type UIEvent } from 'react';
import { cx } from '../internal/classes.ts';
import { LoadState } from '../LoadState/LoadState.tsx';
import { Text } from '../Text/Text.tsx';
import { useIsWide } from '../useIsWide/useIsWide.ts';
import { ColumnMenu } from './ColumnMenu.tsx';
import type { DataTableColumn, DataTableExportColumn, DataTableSort } from './columns.ts';
import { useTableDensity } from './DataTableDensity.tsx';
import { PhoneSort } from './PhoneSort.tsx';
import { HeaderRow } from './header.tsx';
import { layoutOf, PlainBody, VirtualBody } from './rows.tsx';
import { ticksFor, type DataTableSelection } from './Selection.tsx';
import { FilterPills, TableBar } from './TableBar.tsx';
import { useTable, type DataTableSearch } from './useTable.ts';

export type { DataTableColumn, DataTableExportColumn, DataTableSearch, DataTableSelection, DataTableSort };

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
  /**
   * A search box above the table: a row stays when `text` gives something containing what is typed, case aside; or, for a
   * screen with a search of its own (Members: a member number exactly, a mobile's last four digits), when `matches` says so.
   */
  filter?: DataTableSearch<Row>;
  initialSort?: DataTableSort;
  /** Under the search box, a screen's own choice that narrows the rows, such as Members' tiers. */
  belowSearch?: ReactNode;
  /** Beside the filter box, given the rows as shown (filtered and sorted). */
  toolbar?: (rows: readonly Row[]) => ReactNode;
  /** The screen's own filters, in words, which an export records with the table's (#102): `Search: 9000`. */
  exportFilter?: string;
  /** Columns only an export carries, after the table's own: fields a screen keeps off its table. */
  exportColumns?: readonly DataTableExportColumn<Row>[];
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
   * The table's lines scroll sideways at every width, each column at least `size.column` wide, rather than squeeze: a
   * table beside a docked record, which keeps every column (owner, 9 Nov).
   */
  scrollsSideways?: boolean;
  /**
   * A last line that adds the table up: under the rows whatever their order, staying when filters leave no rows, and in the
   * export; not drawn when the table has no rows at all. For a short table, which it keeps from drawing as a long list.
   * Left out where rows can be ticked, as it is no row to tick.
   */
  totalRow?: Row | undefined;
  /**
   * Under a row, across the whole table: what the row opened in place, such as a dealer's new PIN or a setting's new
   * value (console v3); null for none. Not in a long list, whose rows are all one height.
   */
  rowDetail?: (row: Row) => ReactNode;
};

/** Past this many rows, only the rows in view are drawn (additions, "Performance budgets"). */
export const VIRTUAL_FROM = 200;

/** How many rows have their detail open: each is a row of its own, counted with the others. */
function detailCount<Row>(rows: readonly Row[], detail: ((row: Row) => ReactNode) | undefined): number {
  return detail === undefined ? 0 : rows.filter((row) => (detail(row) ?? null) !== null).length;
}

interface TableProps<Row> {
  readonly props: DataTableProps<Row>;
  readonly visible: readonly Row[];
  readonly sort: DataTableSort | null;
  /** The search and the column filters in force, in a word: a long table starts from the top as it changes. */
  readonly resetKey: string;
  readonly onSort: (key: string) => void;
  readonly menuFor: (column: DataTableColumn<Row>) => ReactNode;
}

/** How the rows are laid out: sideways at every width, or below 768 px as cards or lines that scroll. */
const narrowOf = <Row,>(props: DataTableProps<Row>) => (props.scrollsSideways === true ? 'sideways' : props.narrowLayout ?? 'cards');

/** A total row is no row to tick, so where rows can be ticked it is left out. */
function withoutTotalAmongTicks<Row>(props: DataTableProps<Row>): DataTableProps<Row> {
  return props.selection === undefined ? props : { ...props, totalRow: undefined };
}

/** The header, and the line that adds the table up when it has one. */
const linesBesideRows = <Row,>(props: DataTableProps<Row>) => (props.totalRow === undefined ? 1 : 2);

function Table<Row>({ props, visible, sort, resetKey, onSort, menuFor }: TableProps<Row>) {
  const header = useRef<HTMLDivElement>(null);
  // The staff member's own density (decision 0475), unless the table sets one.
  const density = useTableDensity();
  const isVirtual = visible.length > VIRTUAL_FROM && props.totalRow === undefined;
  const ticks = props.selection === undefined ? null : ticksFor(props.selection, visible.map(props.rowKey));
  const layout = layoutOf(props.columns, narrowOf(props), props.density ?? density, ticks);
  // Where the body scrolls sideways, the header, which has no scrollbar, follows it.
  const onScrollX = (event: UIEvent<HTMLElement>) => {
    if (header.current !== null) header.current.scrollLeft = event.currentTarget.scrollLeft;
  };
  const body = { rows: visible, columns: props.columns, rowKey: props.rowKey, onRowOpen: props.onRowOpen, layout, onScrollX };
  const detail = isVirtual ? undefined : props.rowDetail;
  return (
    <div role="table" aria-label={props.label} aria-rowcount={visible.length + detailCount(visible, detail) + linesBesideRows(props)} className="flex flex-col">
      <HeaderRow ref={header} columns={props.columns} sort={sort} onSort={onSort} layout={layout} isVirtual={isVirtual} menuFor={menuFor} />
      {isVirtual
        // A new order or filter starts from the top.
        ? <VirtualBody key={`${sort?.key ?? ''}:${sort?.direction ?? ''}:${resetKey}`} {...body} />
        : <PlainBody {...body} rowDetail={detail} totalRow={props.totalRow} />}
    </div>
  );
}

/** What stands in for the rows: loading, the error with a retry, or why there are none (announced as the filter changes). */
function Instead<Row>({ props, query, isFiltered, isUnderHeader }: { props: DataTableProps<Row>; query: string; isFiltered: boolean; isUnderHeader: boolean }) {
  // Under the header it sits on the cells' edge; with none above it, on the panel's own (audit F-066).
  const inset = isUnderHeader ? 'px-3' : '';
  if (props.status === 'loading') return <div className={cx('py-4', inset)}><LoadState /></div>;
  if (props.status === 'error') return <div className={cx('py-4', inset)}><LoadState isError errorText={props.errorText} onRetry={props.onRetry} /></div>;
  const why = query.trim() === '' && isFiltered ? t('ui.dataTable.noFilterMatch') : t('ui.dataTable.noMatch', { query: query.trim() });
  const text = props.rows.length === 0 ? props.emptyText : why;
  return <div role="status" className={cx('py-4', inset)}><Text tone="muted">{text}</Text></div>;
}

/**
 * Where the focus goes once what had it is gone, such as a pill removed: drawn again first, then the first element of the
 * table matching `selector` (a column's menu, the search box).
 */
function useRefocus() {
  const root = useRef<HTMLDivElement>(null);
  const refocus = (selector: string) => {
    setTimeout(() => root.current?.querySelector<HTMLElement>(selector)?.focus(), 0);
  };
  return { root, refocus };
}

/**
 * The filters in force as pills, once the rows are in: nothing to count while they load or fail to. A filter removed gives
 * the focus to its column's menu; Clear all, to the search box or the first column's menu.
 */
function Pills<Row>({ props, table, refocus }: { props: DataTableProps<Row>; table: ReturnType<typeof useTable<Row>>; refocus: (selector: string) => void }) {
  if (props.status === 'loading' || props.status === 'error') return null;
  return (
    <FilterPills on={table.on} filters={table.view.filters} isSearched={props.filter !== undefined && table.view.query.trim() !== ''}
      shown={table.visible.length} total={table.source.length}
      onRemove={(key) => { table.setFilter(key, undefined); refocus(`[data-column-menu="${key}"]`); }}
      onClearAll={() => { table.clearAll(); refocus('input[type="search"], [data-column-menu]'); }} />
  );
}

/** Each column's menu, in the header (`icon`) or on a phone's bar (`words`); none for a column with neither filter nor order. */
function useColumnMenus<Row>(table: ReturnType<typeof useTable<Row>>) {
  return (column: DataTableColumn<Row>, look: 'icon' | 'words') => {
    const filtered = table.filtered.find((one) => one.column.key === column.key);
    if (filtered === undefined && (look === 'icon' || column.sortValue === undefined)) return null;
    return <ColumnMenu column={column} filtered={filtered} rows={table.source} sort={table.view.sort} onSort={table.setSort} look={look} onClose={table.flush}
      filter={table.view.filters[column.key]} onFilter={(filter, isTyping) => table.setFilter(column.key, filter, isTyping)} />;
  };
}

/**
 * A table of records for the console (`.claude/rules/ui.md`, "Data"): headers that sort, held at the top as the page
 * scrolls, each column's menu to sort it and filter it by its type, the filters in force as pills, an optional search
 * box, optional ticks, and the loading, empty and error states. Its view is kept beneath a DataTableViewProvider (the
 * console: the address). Past 200 rows only the rows in view are drawn, so thousands of rows scroll smoothly. Beneath a
 * DataTableExportProvider, the rows as shown export as CSV or XLSX, each export recorded first (#102).
 */
export function DataTable<Row>(given: DataTableProps<Row>) {
  const props = withoutTotalAmongTicks(given);
  const isWide = useIsWide('medium');
  const table = useTable(props);
  const { root, refocus } = useRefocus();
  const menu = useColumnMenus(table);
  const isCards = !isWide && props.narrowLayout !== 'scroll' && props.scrollsSideways !== true;
  // Rows the search or filters leave none of: the header stays, with each column's menu, and why there are none under it.
  const isNarrowedAway = table.visible.length === 0 && table.source.length > 0;
  // Words searched in a link to a table without a search box are not applied, so never said.
  const instead = <Instead props={props} query={props.filter === undefined ? '' : table.view.query} isFiltered={table.on.length > 0} isUnderHeader={isNarrowedAway && !isCards} />;
  return (
    <div ref={root} className="flex flex-col gap-4">
      <TableBar props={props} visible={table.visible} reservesGutter={table.visible.length > VIRTUAL_FROM} state={{ query: table.view.query, onQuery: table.setQuery, onLeave: table.flush, on: table.on, filters: table.view.filters }} />
      <Pills props={props} table={table} refocus={refocus} />
      {table.visible.length === 0 && !isNarrowedAway ? instead : (
        <>
          {/* Below 768 px the cards sort and filter from a bar above them; a layout with lines keeps its header. */}
          {isCards ? <PhoneSort label={props.label} columns={props.columns} menu={(column) => menu(column, 'words')} /> : null}
          <Table props={props} visible={table.visible} sort={table.view.sort} resetKey={`${table.view.query}:${JSON.stringify(table.view.filters)}`}
            onSort={table.toggleSort} menuFor={(column) => menu(column, 'icon')} />
          {isNarrowedAway ? instead : null}
        </>
      )}
    </div>
  );
}

import { formatNumber, t } from '@rivr/i18n';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../Button/Button.tsx';
import { Icon } from '../Icon/Icon.tsx';
import { Input } from '../Input/Input.tsx';
import { Text } from '../Text/Text.tsx';
import type { DataTableColumn, DataTableExportColumn } from './columns.ts';
import { ExportBar, useTableExporter } from './DataTableExport.tsx';
import { filtersInWords, filterWords, type ColumnFilters, type FilteredColumn } from './filters.ts';
import type { DataTableServer } from './server.ts';
import type { DataTableSearch } from './useTable.ts';

/** What the bar needs of the table's props. */
export interface BarProps<Row> {
  readonly label: string;
  readonly columns: readonly DataTableColumn<Row>[];
  readonly filter?: DataTableSearch<Row> | undefined;
  readonly toolbar?: ((rows: readonly Row[]) => ReactNode) | undefined;
  /** Under the search box, a screen's own choice that narrows the rows, such as Members' tiers. */
  readonly belowSearch?: ReactNode;
  readonly exportFilter?: string | undefined;
  readonly exportColumns?: readonly DataTableExportColumn<Row>[] | undefined;
  readonly totalRow?: Row | undefined;
  readonly exportIn?: HTMLElement | null | undefined;
  readonly server?: DataTableServer | undefined;
  readonly exportRows?: (() => Promise<readonly Row[]>) | undefined;
}

/** What the bar holds: the words searched, and the column filters in force. */
export interface BarState<Row> {
  readonly query: string;
  readonly onQuery: (query: string) => void;
  /** The search left: what was typed is kept at once, so a row opened straight after keeps it. */
  readonly onLeave: () => void;
  readonly on: readonly FilteredColumn<Row>[];
  readonly filters: ColumnFilters;
}

const FILTER_WORDS_MOST = 1000;

/** Every filter in force, in words, as an export records them: the screen's, then the table's search and its columns'. */
function filtersInForce<Row>(props: BarProps<Row>, { query, on, filters }: BarState<Row>): string {
  const typed = query.trim();
  const own = typed === '' || props.filter === undefined ? undefined : `${props.filter.label}: ${typed}`;
  const words = [props.exportFilter, own, ...filtersInWords(on, filters)].filter((part) => part !== undefined && part !== '').join('; ');
  // The audit log takes 1,000 characters: many values picked are cut short rather than stop the export.
  return words.length > FILTER_WORDS_MOST ? `${words.slice(0, FILTER_WORDS_MOST - 1)}…` : words;
}

/** An export-only column as the export reads columns: its own value, and nothing drawn. */
const exportOnly = <Row,>(column: DataTableExportColumn<Row>) => ({ ...column, cell: () => null });

/**
 * How many rows an export would hold: the rows shown, or in server mode every row the view leaves, where the screen
 * reads them (`every`, the read); none where it does not.
 */
function exportedRows<Row>(props: BarProps<Row>, visible: readonly Row[]) {
  if (props.server === undefined) return { count: visible.length, every: undefined };
  if (props.exportRows === undefined) return { count: 0, every: undefined };
  return { count: props.server.total, every: { rows: props.exportRows } };
}

/**
 * The Export control for the rows as shown, beneath a DataTableExportProvider and once there are rows: `here`, at the
 * table's top right, or `elsewhere`, drawn in the element `exportIn` names. In server mode the rows shown are one page of
 * the list, so there is an Export only where the screen reads every row the view leaves (`exportRows`).
 */
function useExportPlaced<Row>(props: BarProps<Row>, visible: readonly Row[], state: BarState<Row>) {
  const exporter = useTableExporter();
  const { count, every } = exportedRows(props, visible);
  const menu = exporter === null || count === 0 ? null
    : <ExportBar isInBar={props.exportIn === undefined} exporter={exporter} label={props.label} columns={[...props.columns, ...(props.exportColumns ?? []).map(exportOnly)]} rows={props.totalRow === undefined ? visible : [...visible, props.totalRow]}
        filter={filtersInForce(props, state)} every={every} />;
  const target = props.exportIn;
  if (target === undefined) return { here: menu, elsewhere: null };
  return { here: null, elsewhere: menu === null || target === null ? null : createPortal(menu, target) };
}

/** How wide this browser draws a scrollbar, for the bar over a long list to keep the list's edge; none where they overlay. */
function scrollbarWidth(): number {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;visibility:hidden;overflow:scroll;width:100px';
  document.body.append(probe);
  const width = probe.offsetWidth - probe.clientWidth;
  probe.remove();
  return width;
}

/**
 * Above the table: the search box, the caller's toolbar, and, beneath a DataTableExportProvider, the Export control at
 * the top right for the rows as shown with every filter in force, or in the element `exportIn` names; nothing when there
 * is none of these.
 */
export function TableBar<Row>({ props, visible, state, reservesGutter }: { props: BarProps<Row>; visible: readonly Row[]; state: BarState<Row>; reservesGutter: boolean }) {
  const { here, elsewhere } = useExportPlaced(props, visible, state);
  if (props.filter === undefined && props.toolbar === undefined && here === null) return <>{elsewhere}{props.belowSearch}</>;
  return (
    <>
      <div className="flex flex-wrap items-end gap-4" style={reservesGutter ? { paddingInlineEnd: scrollbarWidth() } : undefined}>
        {props.filter === undefined ? null : (
          <div className="min-w-0 flex-1 basis-full medium:basis-0">
            <Input type="search" label={props.filter.label} {...(props.filter.variant === undefined ? {} : { variant: props.filter.variant })} value={state.query} autoComplete="off"
              onChange={(event) => state.onQuery(event.target.value)} onBlur={state.onLeave} />
          </div>
        )}
        {props.toolbar?.(visible)}
        {here}
        {elsewhere}
      </div>
      {props.belowSearch}
    </>
  );
}

export interface PillsProps<Row> {
  readonly on: readonly FilteredColumn<Row>[];
  readonly filters: ColumnFilters;
  /** Words are searched: Clear all clears them too. */
  readonly isSearched: boolean;
  readonly shown: number;
  readonly total: number;
  /** The total is a floor ("of 5,050+"): the server stopped counting short of the end. */
  readonly isTotalAtLeast?: boolean;
  /** How many show of all is said though nothing narrows the rows: a table in server mode, which shows a page of them. */
  readonly isCountAlways?: boolean;
  readonly onRemove: (key: string) => void;
  readonly onClearAll: () => void;
}

/**
 * The filters in force as pills (owner, 9 Nov), each removed with its ×; Clear all, which clears the search too, only
 * while a filter or the search is on; and how many rows show of all, said politely as it changes. Nothing while nothing
 * narrows the rows, unless the count is always said.
 */
export function FilterPills<Row>({ on, filters, isSearched, shown, total, isTotalAtLeast = false, isCountAlways = false, onRemove, onClearAll }: PillsProps<Row>) {
  const isNarrowed = on.length > 0 || isSearched;
  if (!isNarrowed && !isCountAlways) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {on.map(({ column, kind }) => {
        const filter = filters[column.key];
        if (filter === undefined) return null;
        const words = t('ui.dataTable.filterInForce', { label: column.header, value: filterWords(filter, kind) });
        return (
          <Button key={column.key} variant="subtle" size="small" aside={<Icon name="close" size="sm" />} aria-label={t('ui.dataTable.removeFilter', { filter: words })}
            onClick={() => onRemove(column.key)}>
            {words}
          </Button>
        );
      })}
      {isNarrowed ? <Button variant="text" size="small" onClick={onClearAll}>{t('ui.dataTable.clearAll')}</Button> : null}
      <span role="status" className="ms-auto">
        <Text variant="small" tone="muted">{t(isTotalAtLeast ? 'ui.dataTable.shownOfAtLeast' : 'ui.dataTable.shownOf', { shown: formatNumber(shown), total: formatNumber(total) })}</Text>
      </span>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { DataTableSort } from './columns.ts';
import { TYPING_MS } from './DataTableView.tsx';
import type { ColumnFilters, FilteredColumn } from './filters.ts';
import type { TableView } from './tableView.ts';

/** What a table in server mode asks its screen for: the order, the words searched, the filters in force and the page, from 1. */
export interface DataTableRequest {
  readonly sort: DataTableSort | null;
  readonly query: string;
  readonly filters: ColumnFilters;
  readonly page: number;
}

/**
 * Server mode (redesign RD-13), for a list too long to load whole: the screen sorts, searches, filters and pages, and
 * gives the table one page of rows.
 */
export interface DataTableServer {
  /** How many rows the search and filters leave, over every page. */
  readonly total: number;
  /** The total is a floor: the count stopped short of the end, as Activity's long log does, and shows as "5,050+". */
  readonly isTotalAtLeast?: boolean | undefined;
  /** How many rows a page holds. */
  readonly pageSize: number;
  /**
   * Given the view in force when the table is first drawn and as it changes, words typed once typing pauses: the screen
   * loads that page. Each call is the whole request, so a screen keys its query on the latest one, and a slow answer to
   * an earlier request cannot overwrite a newer one.
   */
  readonly onRequest: (request: DataTableRequest) => void;
  /**
   * The screen's own filters, in any words that change when they do, such as Members' tier chips, which the table does
   * not hold. When it changes the table starts again from the first page and hands its request over again.
   */
  readonly scope?: string | undefined;
}

/** What the hand-over reads of the table. */
interface ServerInput<Row> {
  readonly server: DataTableServer | undefined;
  readonly view: TableView;
  /** The words searched, trimmed; none for a table without a search box. */
  readonly query: string;
  /** The columns with a filter in force. */
  readonly on: readonly FilteredColumn<Row>[];
  /** Whether the rows are in: until then the total is not known. */
  readonly isReady: boolean;
  /** Whether the last change here was typed. */
  readonly typed: RefObject<boolean>;
  /** Takes the page off the view, back to the first. */
  readonly onFirstPage: () => void;
}

/** How many pages the total makes: one at least. */
export const pageCountOf = (server: DataTableServer): number => Math.max(1, Math.ceil(server.total / server.pageSize));

/** The filters in force, by column, as the screen is handed them. */
function filtersInForce<Row>(on: readonly FilteredColumn<Row>[], filters: ColumnFilters): ColumnFilters {
  return Object.fromEntries(on.flatMap(({ column }) => {
    const filter = filters[column.key];
    return filter === undefined ? [] : [[column.key, filter] as const];
  }));
}

/**
 * The page the view asks for, or the first once the screen's own filters (`scope`) have changed since the page was
 * chosen: the page is then taken off the view too.
 */
function usePageInScope(scope: string | undefined, viewPage: number | undefined, onFirstPage: () => void): number {
  const [pageScope, setPageScope] = useState(scope);
  const isStale = scope !== pageScope;
  useEffect(() => {
    if (!isStale) return;
    setPageScope(scope);
    onFirstPage();
  }, [isStale, scope, onFirstPage]);
  return isStale ? 1 : viewPage ?? 1;
}

/**
 * A table's page in server mode, and the hand-over of its view to the screen: when first drawn and at each change, at
 * once, or once typing pauses for words typed, and again when the screen's own filters change. A page past the last
 * (rows gone since, an old link) is the last.
 */
export function useServerPages<Row>({ server, view, query, on, isReady, typed, onFirstPage }: ServerInput<Row>) {
  const pageCount = server === undefined ? 1 : pageCountOf(server);
  const asked = usePageInScope(server?.scope, view.page, onFirstPage);
  const page = isReady ? Math.min(asked, pageCount) : asked;
  const request = useMemo((): DataTableRequest => ({ sort: view.sort, query, filters: filtersInForce(on, view.filters), page }), [view.sort, view.filters, query, on, page]);
  // The screen's own filters are part of what is asked for, so a change of them hands the request over again.
  const key = `${server?.scope ?? ''}\n${JSON.stringify(request)}`;
  // The screen's callback and the request as they are now, so a screen drawn again does not put the hand-over off.
  const latest = useRef({ onRequest: server?.onRequest, request });
  useEffect(() => {
    latest.current = { onRequest: server?.onRequest, request };
  });
  const isServer = server !== undefined;
  useEffect(() => {
    if (!isServer) return undefined;
    const timer = setTimeout(() => latest.current.onRequest?.(latest.current.request), typed.current ? TYPING_MS : 0);
    return () => clearTimeout(timer);
  }, [isServer, key, typed]);
  return { page, pageCount };
}

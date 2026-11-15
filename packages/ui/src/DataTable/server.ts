import { useEffect, useMemo, useRef, type RefObject } from 'react';
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
  /** How many rows a page holds. */
  readonly pageSize: number;
  /** Given the view in force when the table is first drawn and as it changes, words typed once typing pauses: the screen loads that page. */
  readonly onRequest: (request: DataTableRequest) => void;
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
 * A table's page in server mode, and the hand-over of its view to the screen: when first drawn and at each change, at
 * once, or once typing pauses for words typed. A page past the last (rows gone since, an old link) is the last.
 */
export function useServerPages<Row>({ server, view, query, on, isReady, typed }: ServerInput<Row>) {
  const pageCount = server === undefined ? 1 : pageCountOf(server);
  const asked = view.page ?? 1;
  const page = isReady ? Math.min(asked, pageCount) : asked;
  const request = useMemo((): DataTableRequest => ({ sort: view.sort, query, filters: filtersInForce(on, view.filters), page }), [view.sort, view.filters, query, on, page]);
  const key = JSON.stringify(request);
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

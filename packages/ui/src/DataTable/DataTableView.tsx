import { createContext, use, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { DataTableSort } from './columns.ts';
import { indiaDayOf } from './filters.ts';
import { fromWire, toWire, viewKey, type TableView, type ViewWire } from './tableView.ts';

/** Where tables keep their views (the console: the address), and how a moment's day is found (the club's day). */
export interface TableViewStore {
  /** What the store holds for a table's key, as kept: `fromWire` reads it. */
  read: (key: string) => unknown;
  /** Keeps a table's view, or forgets it (`undefined`) when it is the table's own. */
  write: (key: string, wire: ViewWire | undefined) => void;
  /** A moment's day, `YYYY-MM-DD`, for date filters: Today, Last 7 days. India's calendar day when left out. */
  dayOf?: ((at: Date) => string) | undefined;
}

const ViewStoreContext = createContext<TableViewStore | null>(null);

/** Every DataTable inside keeps its view in `store` (owner, 9 Nov: a table's filters survive opening a row, Back and a link). */
export function DataTableViewProvider({ store, children }: { store: TableViewStore; children: ReactNode }) {
  return <ViewStoreContext value={store}>{children}</ViewStoreContext>;
}

/** How a moment's day is found for date filters. */
export function useDayOf(): (at: Date) => string {
  return use(ViewStoreContext)?.dayOf ?? indiaDayOf;
}

// Words typed are kept once the typing pauses, so the address is not rewritten at each key.
const TYPING_MS = 300;

/** A change not yet kept, with the store's view it was made on. */
interface Pending {
  readonly view: TableView;
  readonly base: string;
}

/**
 * A table's view: kept in the store beneath a DataTableViewProvider, else in the table alone. The store leads: a view
 * it changes (Back, a link) is the one shown. A change here is shown at once and kept straight away, or once typing
 * pauses, or at once by `flush` (a menu closing, the search left), so a row opened straight after keeps it; nothing is
 * kept for a table that has gone, or over a change from outside made meanwhile.
 */
export function useTableView(label: string, initialSort: DataTableSort | null): readonly [TableView, (view: TableView, isTyping?: boolean) => void, () => void] {
  const store = use(ViewStoreContext);
  const key = viewKey(label);
  const kept = store?.read(key);
  const base = JSON.stringify(kept ?? null);
  // The table's own order as plain values, so the view read from the store is made again only when either changes.
  const sortKey = initialSort?.key;
  const sortDirection = initialSort?.direction;
  const fromStore = useMemo(() => fromWire(JSON.parse(base), sortKey === undefined || sortDirection === undefined ? null : { key: sortKey, direction: sortDirection }),
    [base, sortKey, sortDirection]);
  // A change made here, with the store's view it was made on: shown until the store's changes.
  const [own, setOwn] = useState<{ readonly base: string; readonly view: TableView } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pending = useRef<Pending | null>(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const view = own !== null && own.base === base ? own.view : fromStore;
  const keep = ({ view: next, base: madeOn }: Pending) => {
    if (store === null) return;
    // Changed from outside meanwhile (Back): that wins. Nothing new to keep (words still blank): the change stays as typed.
    if (JSON.stringify(store.read(key) ?? null) !== madeOn) {
      setOwn(null);
      return;
    }
    const wire = toWire(next, initialSort);
    if (JSON.stringify(wire ?? null) === madeOn) return;
    store.write(key, wire);
    // Kept: the store leads again, so Back to the view before shows that view.
    setOwn(null);
  };
  const flush = () => {
    const change = pending.current;
    if (change === null) return;
    clearTimeout(timer.current);
    pending.current = null;
    keep(change);
  };
  const setView = (next: TableView, isTyping = false) => {
    setOwn({ base, view: next });
    clearTimeout(timer.current);
    pending.current = { view: next, base };
    timer.current = setTimeout(flush, isTyping ? TYPING_MS : 0);
  };
  return [view, setView, flush] as const;
}

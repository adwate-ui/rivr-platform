import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { Json } from './database.types.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

// What every list read a page at a time from the server shares (redesign RD-29 to RD-31; decisions 0611 and 0612): the
// view a data table hands over, as the server reads it, and what its column menus and chips offer.

/** One column's filter as a data table holds it: words, values chosen, a figure from and to, a preset of days, or days from and to. */
export type ListFilter =
  | { readonly kind: 'text'; readonly typed: string }
  | { readonly kind: 'choice'; readonly chosen: readonly string[] }
  | { readonly kind: 'range'; readonly min: string; readonly max: string }
  | { readonly kind: 'date'; readonly preset: string }
  | { readonly kind: 'dateRange'; readonly from: string; readonly to: string };

/**
 * A list's view as a data table in server mode hands it over (`DataTableRequest` in @rivr/ui): its order, the words
 * searched, each column's filter and the page, from 1. The server sorts, searches, filters and pages by it.
 */
export interface ListView {
  readonly sort: { readonly key: string; readonly direction: 'ascending' | 'descending' } | null;
  readonly query: string;
  readonly filters: Readonly<Record<string, ListFilter>>;
  readonly page: number;
}

/** A view with the screen's own choice beside it, such as a day, a state or one of the door's lists. */
export interface ScopedView extends ListView {
  readonly scope?: Readonly<Record<string, string>> | undefined;
}

/** One page of a list, and how many rows the view leaves over every page. */
export interface ListPage<Row> {
  readonly rows: readonly Row[];
  readonly total: number;
}

/** The lists the server names (`private.list_spec`). */
export type ListName = 'feedback_open' | 'kyc_review' | 'fnb_orders' | 'door' | 'waitlist' | 'bonus_waiting' | 'player_visits' | 'bonus_given';

/** What a list's column menus and chips offer: each counted column's values with how many rows hold each; the values are the server's codes. */
export type ListChoices = Readonly<Record<string, readonly { readonly value: string; readonly count: number }[]>>;

/** How many rows a page holds, and how many an export reads at a time (the API's most). */
export const LIST_PAGE = 50;
export const EXPORT_PAGE = 1000;

/** How often a live list asks again, in milliseconds: its pages and its counts together, so a chip's count is the table's. */
const LIST_EVERY: Readonly<Partial<Record<ListName, number>>> = { feedback_open: 60_000, fnb_orders: 10_000, door: 10_000, waitlist: 10_000, bonus_waiting: 60_000 };

/** A page of rows as the server gives it, each row with the count of all. */
type PageAnswer<Raw> = PromiseLike<{ data: Raw[] | null; error: Error | null }>;

/**
 * Every row a view leaves, for an export: a page of a thousand at a time, by its number from 1, until a short page or the
 * server's count is reached. The one loop every export reads by.
 */
export async function readEveryRow<Raw extends { total: number }, Row>(read: (page: number) => PageAnswer<Raw>, rowOf: (row: Raw) => Row): Promise<Row[]> {
  const rows: Row[] = [];
  for (let at = 1; ; at += 1) {
    const { data, error } = await read(at);
    if (error) throw error;
    const found = data ?? [];
    rows.push(...found.map(rowOf));
    if (found.length < EXPORT_PAGE || rows.length >= Number(found[0]?.total ?? 0)) return rows;
  }
}

/** Each list's own query key, which its pages' and counts' keys start with: whatever makes the list stale makes them stale. */
const LIST_KEY: Readonly<Record<ListName, (userId: string, venueId: string) => readonly unknown[]>> = {
  feedback_open: queryKeys.venueFeedbackOpen, kyc_review: queryKeys.kycReview, fnb_orders: queryKeys.fnbOrdersTonight, door: queryKeys.doorBoard, waitlist: queryKeys.waitlistBoard,
  bonus_waiting: queryKeys.bonusWaiting, player_visits: queryKeys.playerVisits, bonus_given: queryKeys.bonusGiven,
};

/** A filter as JSON for the server. */
function filterJson(filter: ListFilter): Json {
  return filter.kind === 'choice' ? { kind: 'choice', chosen: [...filter.chosen] } : { ...filter };
}

/** A view as the server reads it, at a page and a page's size. */
export function listViewJson(view: ScopedView, page: number = view.page, pageSize: number = LIST_PAGE): { [key: string]: Json } {
  return {
    query: view.query, sort: view.sort === null ? null : { key: view.sort.key, direction: view.sort.direction },
    filters: Object.fromEntries(Object.entries(view.filters).map(([key, filter]) => [key, filterJson(filter)])),
    scope: { ...view.scope }, page, page_size: pageSize,
  };
}

/** A list's counts as the screen reads them, by column. */
export function choicesByColumn(rows: readonly { column_key: string; value: string; members: number }[]): ListChoices {
  const byColumn: Record<string, { value: string; count: number }[]> = {};
  for (const row of rows) (byColumn[row.column_key] ??= []).push({ value: row.value, count: Number(row.members) });
  return byColumn;
}

/**
 * What a list's column menus and chips offer (redesign correction 4), counted on the server over every row the search and
 * the other columns' filters leave (`list_choices`), whatever the page and order. Nothing is asked while `view` is null.
 * A live list's counts ask again as often as its pages do.
 */
export function useListChoices(list: ListName, venueId: string, view: ScopedView | null) {
  const { client, userId } = useRivrData();
  const asked = view === null ? null : listViewJson({ ...view, sort: null }, 1);
  return useQuery({
    queryKey: [...LIST_KEY[list](userId ?? 'signed-out', venueId), 'choices', asked],
    enabled: userId !== null && asked !== null,
    placeholderData: keepPreviousData,
    ...(LIST_EVERY[list] === undefined ? {} : { refetchInterval: LIST_EVERY[list] }),
    queryFn: async (): Promise<ListChoices> => {
      if (asked === null) return {};
      const { data, error } = await client.rpc('list_choices', { p_list: list, p_venue_id: venueId, p_view: asked });
      if (error) throw error;
      return choicesByColumn(data);
    },
  });
}

/** How a list's page is read: the list, the venue, the view, the call, and each row as the screen reads it. */
interface PageRead<Raw, Row> {
  readonly list: ListName;
  readonly venueId: string;
  readonly view: ScopedView | null;
  readonly read: (asked: { [key: string]: Json }) => PageAnswer<Raw>;
  readonly rowOf: (row: Raw) => Row;
}

/**
 * One page of a list, sorted, searched and filtered on the server, with how many rows the view leaves; nothing is asked
 * while `view` is null, before the table has handed its view over. The page before stays on screen while the next loads.
 * A live list asks again on its timer. `readEvery` reads every row the view leaves, for an export (`readEveryRow`).
 */
export function useListPage<Raw extends { total: number }, Row>({ list, venueId, view, read, rowOf }: PageRead<Raw, Row>) {
  const { userId } = useRivrData();
  const asked = view === null ? null : listViewJson(view);
  const page = useQuery({
    queryKey: [...LIST_KEY[list](userId ?? 'signed-out', venueId), 'page', asked],
    enabled: userId !== null && asked !== null,
    placeholderData: keepPreviousData,
    ...(LIST_EVERY[list] === undefined ? {} : { refetchInterval: LIST_EVERY[list] }),
    queryFn: async (): Promise<ListPage<Row>> => {
      if (asked === null) return { rows: [], total: 0 };
      const { data, error } = await read(asked);
      if (error) throw error;
      const rows = data ?? [];
      return { total: Number(rows[0]?.total ?? 0), rows: rows.map(rowOf) };
    },
  });
  const readEvery = async (): Promise<Row[]> => (view === null ? [] : readEveryRow((at) => read(listViewJson(view, at, EXPORT_PAGE)), rowOf));
  return { ...page, readEvery };
}

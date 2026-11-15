import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { Json } from './database.types.ts';
import { detailsOf, type MemberPageRow } from './memberDetails.ts';
import { kycStatusOf, type MemberListRow } from './members.ts';
import { toPaise } from './parse/hands.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

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

/** The Members list's view: the table's, and the tier chosen above it, or null for every tier. */
export interface MembersView extends ListView {
  readonly tierId: string | null;
}

/** One page of the Members list, and how many members the view leaves over every page. */
export interface MembersPage {
  readonly rows: readonly MemberListRow[];
  readonly total: number;
}

/** A column menu's values on the Members list, each with how many members hold it, by column. */
export type MemberChoices = Readonly<Record<MemberChoiceColumn, readonly { readonly value: string; readonly count: number }[]>>;
export type MemberChoiceColumn = 'status' | 'kyc' | 'city' | 'tonight';

/** How many members a page of the list holds, and how many an export reads at a time (the API's most). */
export const MEMBERS_PAGE = 50;
const EXPORT_PAGE = 1000;

/** A filter as JSON for the server. */
function filterJson(filter: ListFilter): Json {
  return filter.kind === 'choice' ? { kind: 'choice', chosen: [...filter.chosen] } : { ...filter };
}

/** A view as the server reads it (`members_page`, `members_choices`), at a page and a page's size. */
function viewJson(view: MembersView, page: number, pageSize: number): Json {
  return {
    tier_id: view.tierId ?? '', query: view.query, sort: view.sort === null ? null : { key: view.sort.key, direction: view.sort.direction },
    filters: Object.fromEntries(Object.entries(view.filters).map(([key, filter]) => [key, filterJson(filter)])), page, page_size: pageSize,
  };
}

/**
 * One page of the Members list (redesign RD-29), sorted, searched and filtered on the server (`members_page`), for staff
 * who read members; `view` is null until the table has handed its view over. The page before stays on screen while the
 * next loads. The full mobile comes only to staff who change one; identity documents only to super admins.
 */
export function useMembersPage(venueId: string, view: MembersView | null) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.membersList(userId ?? 'signed-out', venueId, view === null ? null : viewJson(view, view.page, MEMBERS_PAGE)),
    enabled: userId !== null && view !== null,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<MembersPage> => {
      if (view === null) return { rows: [], total: 0 };
      const { data, error } = await client.rpc('members_page', { p_venue_id: venueId, p_view: viewJson(view, view.page, MEMBERS_PAGE) });
      if (error) throw error;
      return { total: Number(data[0]?.total ?? 0), rows: data.map(rowOf) };
    },
  });
}

/** A row of the list as the screen reads it. */
function rowOf(row: MemberPageRow): MemberListRow {
  return {
    memberId: row.member_id, memberNumber: row.member_number, fullName: row.full_name, phone: row.phone, phoneLast4: row.phone_last4,
    tierName: row.tier_name, visits: row.visits, lastVisitAt: row.last_visit_at, kycStatus: kycStatusOf(row.kyc_status),
    minutesPlayed: Number(row.minutes_played), city: row.city, memberSince: row.member_since, bonus: toPaise(row.bonus_paise), details: detailsOf(row),
  };
}

/**
 * What each column's menu offers on the Members list (redesign correction 4): the values of Status, ID check, City and
 * Tonight, each with how many members hold it over every member the search, the tier and the other columns leave
 * (`members_choices`), not the page. The values are the server's codes; the screen words them.
 */
export function useMemberChoices(venueId: string, view: MembersView | null) {
  const { client, userId } = useRivrData();
  return useQuery({
    // The page and the order change no count.
    queryKey: queryKeys.memberChoices(userId ?? 'signed-out', venueId, view === null ? null : viewJson({ ...view, sort: null }, 1, MEMBERS_PAGE)),
    enabled: userId !== null && view !== null,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<MemberChoices> => {
      if (view === null) return { status: [], kyc: [], city: [], tonight: [] };
      const { data, error } = await client.rpc('members_choices', { p_venue_id: venueId, p_view: viewJson({ ...view, sort: null }, 1, MEMBERS_PAGE) });
      if (error) throw error;
      const of = (column: MemberChoiceColumn) => data.filter((row) => row.column_key === column).map((row) => ({ value: row.value, count: Number(row.members) }));
      return { status: of('status'), kyc: of('kyc'), city: of('city'), tonight: of('tonight') };
    },
  });
}

/**
 * Reads every member a view leaves, for an export (redesign RD-29: "every row that matches, not the page"): page after
 * page of a thousand, in the view's order, until the server's total is reached.
 */
export function useEveryMember(venueId: string) {
  const { client } = useRivrData();
  return async (view: MembersView): Promise<MemberListRow[]> => {
    const rows: MemberListRow[] = [];
    for (let page = 1; ; page += 1) {
      const { data, error } = await client.rpc('members_page', { p_venue_id: venueId, p_view: viewJson(view, page, EXPORT_PAGE) });
      if (error) throw error;
      rows.push(...data.map(rowOf));
      if (data.length < EXPORT_PAGE || rows.length >= Number(data[0]?.total ?? 0)) return rows;
    }
  };
}

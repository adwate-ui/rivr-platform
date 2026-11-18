import type { Paise } from '@rivr/domain/money';
import { useQuery } from '@tanstack/react-query';
import { visitsOf, type VisitTimes } from './bonusApprovals.ts';
import { tablesOf, type TodaysPlayer } from './floorToday.ts';
import { LIST_MOST } from './limits.ts';
import { useListPage, type ScopedView } from './lists.ts';
import { kycStatusOf, type MemberKycStatus } from './members.ts';
import { toPaise } from './parse/hands.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

// Reports beside Tables (redesign RD-27): Players, Waitlist, Food and drink and Bonus, each computed on the server over a span of
// 1 to 92 club days for staff who read reports. A report is four figures, a chart by the hour or the day, and a table of a few rows.

/** The reports with a chart. Tables has its figures from its own total (`useTableMetricsTotal`). */
export type ChartReport = 'tables' | 'players' | 'waitlist' | 'fnb' | 'bonus';
export type FigureReport = Exclude<ChartReport, 'tables'>;

/** A span of club days at a venue: `from` to `to` (YYYY-MM-DD), 1 to 92 days. */
export interface ReportSpan {
  readonly venueId: string;
  readonly from: string;
  readonly to: string;
}

/** One read of a report: its name in the cache, the call, and each row as the screen reads it. */
interface ReportRead<Raw, Line> {
  readonly name: string;
  readonly read: () => PromiseLike<{ data: Raw[] | null; error: Error | null }>;
  readonly lineOf: (row: Raw) => Line;
}

function useReportLines<Raw, Line>(span: ReportSpan, { name, read, lineOf }: ReportRead<Raw, Line>) {
  const { userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.clubReport(userId ?? 'signed-out', name, span),
    enabled: userId !== null,
    queryFn: async (): Promise<Line[]> => {
      const { data, error } = await read();
      if (error) throw error;
      return (data ?? []).map(lineOf);
    },
  });
}

const oneOf = <Known extends string>(known: readonly Known[], value: string, otherwise: Known): Known => known.find((one) => one === value) ?? otherwise;

/** One bar of a report's chart: when its hour or its club day began, and its figure (Bonus in paise). */
export interface ReportBar {
  readonly at: string;
  readonly amount: number;
}

/** A report's chart (`report_chart`): a bar an hour over one club day, a bar a club day over a longer span. */
export function useReportChart(span: ReportSpan, report: ChartReport) {
  const { client } = useRivrData();
  return useReportLines(span, {
    name: `chart:${report}`,
    read: () => client.rpc('report_chart', { p_venue_id: span.venueId, p_report: report, p_from: span.from, p_to: span.to }).limit(LIST_MOST),
    lineOf: (row): ReportBar => ({ at: row.bucket, amount: Number(row.amount) }),
  });
}

/** One of a report's four figures by its name: a count, whole seconds, or Bonus in paise. */
export interface ReportFigure {
  readonly figure: string;
  readonly amount: number;
}

/** A report's four figures (`report_figures`). */
export function useReportFigures(span: ReportSpan, report: FigureReport) {
  const { client } = useRivrData();
  return useReportLines(span, {
    name: `figures:${report}`,
    read: () => client.rpc('report_figures', { p_venue_id: span.venueId, p_report: report, p_from: span.from, p_to: span.to }).limit(LIST_MOST),
    lineOf: (row): ReportFigure => ({ figure: row.figure, amount: Number(row.amount) }),
  });
}

const PLAYER_MEASURES = ['played', 'tier', 'first_visit', 'id_checks'] as const;

/** A line of the Players report: the members who played, the same for one tier (`label`, its name), those on a first visit, or the ID checks done. */
export interface PlayersLine {
  readonly place: number;
  readonly measure: (typeof PLAYER_MEASURES)[number];
  readonly label: string | null;
  readonly amount: number;
}

/** The Players report's lines (`players_report`). */
export function usePlayersReport(span: ReportSpan) {
  const { client } = useRivrData();
  return useReportLines(span, {
    name: 'players',
    read: () => client.rpc('players_report', { p_venue_id: span.venueId, p_from: span.from, p_to: span.to }).limit(LIST_MOST),
    lineOf: (row): PlayersLine => ({ place: row.place, measure: oneOf(PLAYER_MEASURES, row.measure, 'played'), label: row.label, amount: Number(row.amount) }),
  });
}

/** One visit in a report's span (decision 0682): a member on a club day, as the door's Today's players gives that day. */
export interface PlayerVisit extends Omit<TodaysPlayer, 'status'> {
  /** The club day, YYYY-MM-DD. */
  readonly clubDay: string;
  readonly tierName: string;
  /** On the club's lowest tier, which the door leaves unsaid. */
  readonly isBaseTier: boolean;
  /** Every table's time that day, in seconds. */
  readonly playedSeconds: number;
  /** Their identity check as it stands now. */
  readonly kycStatus: MemberKycStatus;
  /** The Bonus given to them that club day, by hand or by promotions once approved (#1062). */
  readonly bonus: Paise;
  /** For a super admin, the day's visits with their seats, to correct (#1075); none for anyone else. */
  readonly visits: readonly VisitTimes[];
}

/**
 * One page of the visits in a report's span (`player_visits_page`), sorted, searched and filtered on the server like the
 * door's, with how many the view leaves; the span is the view's scope. Newest day first unless the view says otherwise.
 */
export function usePlayerVisitsPage(span: ReportSpan, view: ScopedView | null) {
  const { client } = useRivrData();
  return useListPage({
    list: 'player_visits', venueId: span.venueId, view: scopedTo(span, view),
    read: (asked) => client.rpc('player_visits_page', { p_venue_id: span.venueId, p_view: asked }),
    rowOf: (row): PlayerVisit => ({
      clubDay: row.club_day, memberId: row.member_id, fullName: row.full_name, memberNumber: Number(row.member_number), tierName: row.tier_name,
      isBaseTier: row.is_base_tier, checkedInAt: row.checked_in_at, checkedOutAt: row.checked_out_at, waitingSeconds: row.waiting_seconds, tables: tablesOf(row.tables),
      playedSeconds: Number(row.played_seconds), kycStatus: kycStatusOf(row.kyc_status), bonus: toPaise(row.bonus_paise), visits: visitsOf(row.visits),
    }),
  });
}

/** A visits view with the report's span as its scope, for its page and its column menus alike. */
export function scopedTo(span: ReportSpan, view: ScopedView | null): ScopedView | null {
  return view === null ? null : { ...view, scope: { from: span.from, to: span.to } };
}

/** One table's list over the span: who joined, who got a seat, who left the list, and the average and longest wait to a seat. */
export interface WaitlistLine {
  readonly tableId: string;
  readonly tableName: string;
  readonly joined: number;
  readonly seated: number;
  readonly leftList: number;
  readonly waitSeconds: number;
  readonly longestSeconds: number;
}

/** The Waitlist report's lines, a table each in the floor's order (`waitlist_report`). */
export function useWaitlistReport(span: ReportSpan) {
  const { client } = useRivrData();
  return useReportLines(span, {
    name: 'waitlist',
    read: () => client.rpc('waitlist_report', { p_venue_id: span.venueId, p_from: span.from, p_to: span.to }).limit(LIST_MOST),
    lineOf: (row): WaitlistLine => ({
      tableId: row.table_id, tableName: row.table_name, joined: Number(row.joined), seated: Number(row.seated), leftList: Number(row.left_list),
      waitSeconds: Number(row.wait_seconds), longestSeconds: Number(row.longest_seconds),
    }),
  });
}

const FNB_GROUPS = ['table', 'staff'] as const;

/** Orders by table or by the staff member who accepted them (`label` null: nobody did): how many, their items, the average seconds to accept and to serve, and how many were void. */
export interface FnbLine {
  readonly groupedBy: (typeof FNB_GROUPS)[number];
  readonly label: string | null;
  readonly orders: number;
  readonly items: number;
  readonly acceptSeconds: number;
  readonly serveSeconds: number;
  readonly voided: number;
}

/** The Food and drink report's lines, by table then by staff member (`fnb_report`). */
export function useFnbReport(span: ReportSpan) {
  const { client } = useRivrData();
  return useReportLines(span, {
    name: 'fnb',
    read: () => client.rpc('fnb_report', { p_venue_id: span.venueId, p_from: span.from, p_to: span.to }).limit(LIST_MOST),
    lineOf: (row): FnbLine => ({
      groupedBy: oneOf(FNB_GROUPS, row.grouped_by, 'table'), label: row.label, orders: Number(row.orders), items: Number(row.items),
      acceptSeconds: Number(row.accept_seconds), serveSeconds: Number(row.serve_seconds), voided: Number(row.voided),
    }),
  });
}

const BONUS_SOURCES = ['promotion', 'hand', 'other', 'reversed'] as const;

/**
 * Bonus given from one place: a promotion (`label`, its name), by hand, or anything else by its reason; to how many members,
 * in how many grants. `reversed` is what reversals took back in the span, below zero, on its own line (#1077).
 */
export interface BonusLine {
  readonly source: (typeof BONUS_SOURCES)[number];
  readonly label: string | null;
  readonly members: number;
  readonly grants: number;
  readonly given: Paise;
}

/** The Bonus report's lines, the most given first (`bonus_report`). */
export function useBonusReport(span: ReportSpan) {
  const { client } = useRivrData();
  return useReportLines(span, {
    name: 'bonus',
    read: () => client.rpc('bonus_report', { p_venue_id: span.venueId, p_from: span.from, p_to: span.to }).limit(LIST_MOST),
    lineOf: (row): BonusLine => ({
      source: oneOf(BONUS_SOURCES, row.source, 'other'), label: row.label, members: Number(row.members), grants: Number(row.grants), given: toPaise(row.given_paise),
    }),
  });
}

/** Where a Bonus came from (#1063): by hand, a promotion once approved, a high hand, or anything else (rakeback, a referral). */
export type BonusSource = 'by_hand' | 'promotion' | 'high_hand' | 'other' | 'reversed';

const GIVEN_SOURCES: readonly BonusSource[] = ['by_hand', 'promotion', 'high_hand', 'other', 'reversed'];

/** Where a Bonus came from, as the list or its filter names it; any other word reads as other. */
export const bonusSourceOf = (value: string): BonusSource => GIVEN_SOURCES.find((source) => source === value) ?? 'other';

/**
 * A Bonus given in a report's span (#1063): when, to whom, how much and why; where it came from, the promotion's name for
 * one, and who gave it: the staff member by hand, the super admin who approved a promotion's, or who logged a high hand.
 */
export interface BonusGiven {
  readonly grantId: string;
  readonly givenAt: string;
  readonly memberId: string;
  readonly fullName: string;
  readonly memberNumber: number;
  readonly amount: Paise;
  readonly reason: string;
  readonly source: BonusSource;
  readonly promotionName: string | null;
  readonly staffName: string | null;
}

/**
 * One page of the Bonus given in a report's span (`bonus_given_page`), newest first unless the view says otherwise, sorted,
 * searched and filtered on the server like the report's other lists; the span is the view's scope.
 */
export function useBonusGivenPage(span: ReportSpan, view: ScopedView | null) {
  const { client } = useRivrData();
  return useListPage({
    list: 'bonus_given', venueId: span.venueId, view: scopedTo(span, view),
    read: (asked) => client.rpc('bonus_given_page', { p_venue_id: span.venueId, p_view: asked }),
    rowOf: (row): BonusGiven => ({
      grantId: row.grant_id, givenAt: row.given_at, memberId: row.member_id, fullName: row.full_name, memberNumber: Number(row.member_number),
      amount: toPaise(row.amount_paise), reason: row.reason, source: bonusSourceOf(row.source),
      promotionName: row.promotion_name, staffName: row.staff_name,
    }),
  });
}

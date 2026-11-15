import type { Paise } from '@rivr/domain/money';
import { useQuery } from '@tanstack/react-query';
import { LIST_MOST } from './limits.ts';
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

const BONUS_SOURCES = ['promotion', 'hand', 'other'] as const;

/** Bonus given from one place: a promotion (`label`, its name), by hand, or anything else by its reason; to how many members, in how many grants. */
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

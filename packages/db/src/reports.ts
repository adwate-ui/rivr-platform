import { misReportSchema, type MisReportJson } from '@rivr/contracts/reports';
import type { Paise } from '@rivr/domain/money';
import { useQuery } from '@tanstack/react-query';
import { toPaise } from './parse/hands.ts';
import { useRivrData } from './provider.tsx';

// Kept here, not in queryKeys: this module is its own subpath (@rivr/db/reports), off the player's first load.
const keys = {
  rakeTonight: (userId: string, venueId: string) => ['user', userId, 'rake-tonight', venueId] as const,
  misReport: (userId: string, venueId: string, month: string) => ['user', userId, 'mis-report', venueId, month] as const,
  unclaimed: (userId: string, venueId: string) => ['user', userId, 'unclaimed-balances', venueId] as const,
};

// Tonight's figures move as hands are logged; a minute is fresh enough for a report.
const TONIGHT_REFRESH_MS = 60_000;

/** A table, dealer or game (`holdem`, `plo`, `bomb_pot`) with its hands, rake and jackpot drop. */
export interface RakeRow {
  readonly key: string;
  readonly label: string;
  readonly hands: number;
  readonly rake: Paise;
  readonly drop: Paise;
}

/** Rake by table, dealer and game, the most first. */
export interface RakeBreakdown {
  readonly byTable: readonly RakeRow[];
  readonly byDealer: readonly RakeRow[];
  readonly byVariant: readonly RakeRow[];
}

/** A revenue or expense account and what it took in the month. */
export interface AccountLine {
  readonly code: string;
  readonly name: string;
  readonly amount: Paise;
}

/** A promotion's cost in a club month (#111): its grants and cost then, its cost to the month's end, and its budget: a cap in rupees, on grants, or null for none. */
export interface PromotionCost {
  readonly id: string;
  readonly name: string;
  readonly grants: number;
  readonly cost: Paise;
  readonly costToDate: Paise;
  readonly budget: Paise | null;
  readonly budgetGrants: number | null;
}

/** One month of a cohort: how many of its members visited, and what share of them, in whole percent rounded down (the database's). */
export interface CohortMonth {
  readonly month: string;
  readonly returned: number;
  readonly percent: number;
}

/** The members whose first visit fell in a club month (#111), and how many came back each month from then. */
export interface Cohort {
  readonly month: string;
  readonly members: number;
  readonly months: readonly CohortMonth[];
}

/** A club month's investor MIS (#99): stored on the 1st, or the month so far as a preview. */
export interface MisReport extends RakeBreakdown {
  /** The month's first day, `2026-11-01`. */
  readonly month: string;
  readonly hands: number;
  readonly rake: Paise;
  readonly drop: Paise;
  readonly revenue: readonly AccountLine[];
  readonly expenses: readonly AccountLine[];
  readonly totalRevenue: Paise;
  readonly totalExpenses: Paise;
  readonly net: Paise;
  readonly visits: number;
  readonly members: number;
  readonly promotions: readonly PromotionCost[];
  readonly cohorts: readonly Cohort[];
  /** When it was stored, or null for a preview. */
  readonly generatedAt: string | null;
  readonly isPreview: boolean;
}

interface RakeRowJson {
  readonly key: string;
  readonly label: string;
  readonly hands: number;
  readonly rake_paise: number;
  readonly drop_paise: number;
}

const rakeRow = (row: RakeRowJson): RakeRow => ({ key: row.key, label: row.label, hands: row.hands, rake: toPaise(row.rake_paise), drop: toPaise(row.drop_paise) });
const accountLine = (row: MisReportJson['revenue'][number]): AccountLine => ({ code: row.code, name: row.name, amount: toPaise(row.paise) });

const promotionCost = (row: MisReportJson['promotions'][number]): PromotionCost => ({
  id: row.id, name: row.name, grants: row.grants, cost: toPaise(row.cost_paise), costToDate: toPaise(row.cost_to_date_paise),
  budget: row.budget_paise === null ? null : toPaise(row.budget_paise), budgetGrants: row.budget_grants,
});

const cohort = (row: MisReportJson['cohorts'][number]): Cohort => ({ month: row.month, members: row.members, months: row.months });

function misReport(json: MisReportJson, generatedAt: string | null, isPreview: boolean): MisReport {
  return {
    month: json.month, hands: json.hands, rake: toPaise(json.rake_paise), drop: toPaise(json.drop_paise),
    byTable: json.rake_by_table.map(rakeRow), byDealer: json.rake_by_dealer.map(rakeRow), byVariant: json.rake_by_variant.map(rakeRow),
    revenue: json.revenue.map(accountLine), expenses: json.expenses.map(accountLine),
    totalRevenue: toPaise(json.revenue_paise), totalExpenses: toPaise(json.expense_paise), net: toPaise(json.net_paise),
    visits: json.visits, members: json.members, promotions: json.promotions.map(promotionCost), cohorts: json.cohorts.map(cohort),
    generatedAt, isPreview,
  };
}

/** Tonight's rake by table, dealer and game, from the hands logged since 06:00, for staff who read reports. */
export function useRakeTonight(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: keys.rakeTonight(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    refetchInterval: TONIGHT_REFRESH_MS,
    queryFn: async (): Promise<RakeBreakdown> => {
      const { data, error } = await client.rpc('rake_tonight', { p_venue_id: venueId });
      if (error) throw error;
      const of = (dimension: string) => data.filter((row) => row.dimension === dimension).map(rakeRow);
      return { byTable: of('table'), byDealer: of('dealer'), byVariant: of('variant') };
    },
  });
}

/** A club month's MIS (`2026-11-01`), as stored or as a preview of the month so far. */
export function useMisReport(venueId: string, month: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: keys.misReport(userId ?? 'signed-out', venueId, month),
    enabled: userId !== null,
    queryFn: async (): Promise<MisReport> => {
      const { data, error } = await client.rpc('mis_report_for', { p_venue_id: venueId, p_month: month });
      if (error) throw error;
      const [row] = data;
      if (row === undefined) throw new Error('The MIS came back empty');
      return misReport(misReportSchema.parse(row.report), row.generated_at, row.is_preview);
    },
  });
}

/** A member's balance with the club, untouched for the venue's period (#110). */
export interface UnclaimedBalance {
  readonly memberId: string;
  readonly memberNumber: number;
  readonly fullName: string;
  readonly cash: Paise;
  readonly bonus: Paise;
  /** When the member last moved money or visited. */
  readonly lastSeenAt: string;
}

/** The balances no one has touched for the venue's period, the quietest first, for staff who read reports. */
export function useUnclaimedBalances(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: keys.unclaimed(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<UnclaimedBalance[]> => {
      const { data, error } = await client.rpc('unclaimed_balances', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({
        memberId: row.member_id, memberNumber: row.member_number, fullName: row.full_name,
        cash: toPaise(row.cash_paise), bonus: toPaise(row.bonus_paise), lastSeenAt: row.last_seen_at,
      }));
    },
  });
}

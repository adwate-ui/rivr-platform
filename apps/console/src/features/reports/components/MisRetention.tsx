import type { Cohort, PromotionCost } from '@rivr/db/reports';
import { formatMonth, formatNumber, t } from '@rivr/i18n';
import { DataTable, Money, type DataTableColumn } from '@rivr/ui';

const promotionColumns = (): readonly DataTableColumn<PromotionCost>[] => [
  { key: 'promotion', header: t('console.reports.promotion'), cell: (row) => row.name, sortValue: (row) => row.name },
  { key: 'grants', header: t('console.reports.grants'), align: 'end', cell: (row) => formatNumber(row.grants), sortValue: (row) => row.grants },
  { key: 'cost', header: t('console.reports.costMonth'), align: 'end', cell: (row) => <Money paise={row.cost} />, sortValue: (row) => row.cost },
  { key: 'toDate', header: t('console.reports.costToDate'), align: 'end', cell: (row) => <Money paise={row.costToDate} />, sortValue: (row) => row.costToDate },
  { key: 'budget', header: t('console.reports.budget'), align: 'end', cell: (row) => <Budget row={row} /> },
];

/** A promotion's budget: its cap in rupees, its cap on grants, or No cap. */
function Budget({ row }: { row: PromotionCost }) {
  if (row.budget !== null) return <Money paise={row.budget} />;
  return row.budgetGrants === null ? t('console.reports.noBudget') : t('console.reports.budgetGrants', { count: formatNumber(row.budgetGrants) });
}

/** Each promotion that gave anything this month (#111): its grants and cost, its cost so far, and its budget. */
export function PromotionCostTable({ rows, exportFilter }: { rows: readonly PromotionCost[]; exportFilter: string }) {
  return (
    <DataTable label={t('console.reports.promotions')} columns={promotionColumns()} rowKey={(row) => row.id} rows={rows}
      emptyText={t('console.reports.noPromotions')} exportFilter={exportFilter} />
  );
}

/** A cohort's first month, its members, then each later month as returned (share): as many columns as the oldest has months. */
function cohortColumns(width: number): readonly DataTableColumn<Cohort>[] {
  const months = Array.from({ length: width }, (_, index): DataTableColumn<Cohort> => ({
    key: `month-${index}`, header: t('console.reports.monthNumber', { number: String(index + 1) }), align: 'end',
    cell: (row) => {
      const month = row.months[index];
      return month === undefined ? '' : t('console.reports.retained', { count: formatNumber(month.returned), percent: String(month.percent) });
    },
  }));
  return [
    { key: 'cohort', header: t('console.reports.cohort'), cell: (row) => formatMonth(row.month), sortValue: (row) => row.month },
    { key: 'members', header: t('console.reports.cohortMembers'), align: 'end', cell: (row) => formatNumber(row.members), sortValue: (row) => row.members },
    ...months,
  ];
}

/** Cohort retention (#111): the members whose first visit fell in each of the last six club months, and how many came back. */
export function CohortTable({ rows, exportFilter }: { rows: readonly Cohort[]; exportFilter: string }) {
  const width = Math.max(1, ...rows.map((row) => row.months.length));
  return (
    <DataTable label={t('console.reports.cohorts')} columns={cohortColumns(width)} rowKey={(row) => row.month} rows={rows}
      emptyText={t('console.reports.noCohorts')} exportFilter={exportFilter} />
  );
}

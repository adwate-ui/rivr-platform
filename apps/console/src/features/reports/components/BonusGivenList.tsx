import { bonusSourceOf, LIST_PAGE, scopedTo, useBonusGivenPage, useListChoices, type BonusGiven, type BonusSource, type ListChoices, type ReportSpan } from '@rivr/db';
import { formatChips, formatDateTime, formatRupeesForFile, t } from '@rivr/i18n';
import { DataTable, Text, type ColumnChoice, type DataTableColumn, type DataTableRequest } from '@rivr/ui';
import { useState } from 'react';

const NONE = () => t('console.todaysPlayers.none');
const sourceWords = (source: BonusSource) => t(`console.reports.bonusGiven.sources.${source}`);

/**
 * Who gave it: the staff member by hand; a promotion and the super admin who approved it; who logged a high hand. A
 * reversal (#1077), below nothing on its own day: who reversed it.
 */
function givenBy(bonus: BonusGiven): string {
  if (bonus.source === 'reversed') return bonus.staffName === null ? sourceWords('reversed') : t('console.reports.bonusGiven.reversedBy', { name: bonus.staffName });
  if (bonus.source === 'by_hand') return bonus.staffName ?? sourceWords('by_hand');
  if (bonus.source === 'high_hand') return bonus.staffName === null ? sourceWords('high_hand') : t('console.reports.bonusGiven.loggedBy', { name: bonus.staffName });
  if (bonus.source === 'promotion') {
    const promotion = bonus.promotionName ?? sourceWords('promotion');
    return bonus.staffName === null ? promotion : t('console.reports.bonusGiven.approvedBy', { promotion, name: bonus.staffName });
  }
  return NONE();
}

/** Where they came from, each with the server's count over the Bonus the other filters leave. */
const sourceChoices = (counted: ListChoices | undefined): readonly ColumnChoice[] =>
  (counted?.['source'] ?? []).map(({ value, count }) => ({ value, count, label: sourceWords(bonusSourceOf(value)) }));

function givenColumns(counted: ListChoices | undefined): readonly DataTableColumn<BonusGiven>[] {
  const when = (bonus: BonusGiven) => formatDateTime(new Date(bonus.givenAt));
  const amount = (bonus: BonusGiven) => Number(formatRupeesForFile(bonus.amount));
  return [
    { key: 'when', share: 1.2, header: t('console.reports.bonusGiven.when'), sortValue: (bonus) => bonus.givenAt, exportValue: when, filter: false,
      cell: (bonus) => <Text variant="secondary" tone="muted">{when(bonus)}</Text> },
    { key: 'member', share: 1.4, priority: 'primary', header: t('console.reports.bonusGiven.member'), sortValue: (bonus) => bonus.fullName, filter: false, cell: (bonus) => bonus.fullName },
    { key: 'number', share: 0.6, header: t('console.reports.bonusGiven.number'), sortValue: (bonus) => bonus.memberNumber, filter: false, cell: (bonus) => String(bonus.memberNumber) },
    { key: 'amount', share: 0.8, header: t('console.reports.bonusGiven.amount'), align: 'end', sortValue: amount, exportValue: amount, filter: false, cell: (bonus) => formatChips(bonus.amount) },
    { key: 'source', share: 0.9, header: t('console.reports.bonusGiven.from'), filter: 'choice', choices: sourceChoices(counted),
      filterValue: (bonus) => bonus.source, sortValue: (bonus) => bonus.source, cell: (bonus) => sourceWords(bonus.source) },
    { key: 'by', share: 1.6, isWide: true, header: t('console.reports.bonusGiven.by'), sortValue: (bonus) => bonus.staffName ?? '', filter: false, cell: givenBy },
    { key: 'reason', share: 1.6, isWide: true, header: t('console.reports.bonusGiven.reason'), sortValue: (bonus) => bonus.reason, filter: false, cell: (bonus) => bonus.reason },
  ];
}

function stateOf(page: ReturnType<typeof useBonusGivenPage>) {
  if (page.data !== undefined) return { rows: page.data.rows, emptyText: t('console.reports.bonusGiven.empty') };
  return page.isError ? { status: 'error' as const, onRetry: () => void page.refetch() } : { status: 'loading' as const };
}

/**
 * Each Bonus given in the report's span (the owner, 17 Nov; #1063): when, to whom, how much, where it came from, who gave
 * it and why, a page at a time from the server, sorted and filtered there, with its own Export.
 */
export function BonusGivenList({ span, periodWords }: { span: ReportSpan; periodWords: string }) {
  // The table's view as it last handed it over; none until it is first drawn.
  const [request, setRequest] = useState<DataTableRequest | null>(null);
  const page = useBonusGivenPage(span, request);
  const counted = useListChoices('bonus_given', span.venueId, scopedTo(span, request)).data;
  return (
    <DataTable {...stateOf(page)} label={t('console.reports.bonusGiven.label')} columns={givenColumns(counted)} narrowLayout="scroll"
      rowKey={(bonus) => bonus.grantId} exportFilter={periodWords}
      filter={{ label: t('console.reports.bonusGiven.search'), variant: 'subtle', text: (bonus) => `${bonus.fullName} ${bonus.staffName ?? ''} ${bonus.reason}` }}
      server={{ total: page.data?.total ?? 0, pageSize: LIST_PAGE, onRequest: setRequest, scope: `${span.from}:${span.to}` }} exportRows={page.readEvery} />
  );
}

import { LIST_PAGE, scopedTo, useListChoices, usePlayerVisitsPage, type ListChoices, type MemberKycStatus, type PlayerVisit, type ReportSpan } from '@rivr/db';
import { formatChips, formatDate, formatDuration, formatRupeesForFile, formatTime, t } from '@rivr/i18n';
import { DataTable, DotStatus, Text, type ColumnChoice, type DataTableColumn, type DataTableRequest, type DotStatusTone } from '@rivr/ui';
import { useState } from 'react';

// As the door shows an identity check: cream once verified, gold while the club has something to do, red refused.
const KYC_TONE: Readonly<Record<MemberKycStatus, DotStatusTone>> = {
  verified: 'active', in_review: 'needsYou', at_desk: 'needsYou', refused: 'danger', not_done: 'inactive',
};
const KYC: readonly MemberKycStatus[] = ['verified', 'in_review', 'at_desk', 'refused', 'not_done'];

const NONE = () => t('console.todaysPlayers.none');
const at = (iso: string | null) => (iso === null ? NONE() : formatTime(new Date(iso)));
const tablesOf = (visit: PlayerVisit) => (visit.tables.length === 0 ? NONE() : visit.tables.map((entry) => entry.table).join(', '));
const kycWords = (status: MemberKycStatus) => t(`console.members.kycStatuses.${status}`);
// A club day as a date: noon IST that day, so the date is the day's whatever the browser's zone.
const dayOf = (visit: PlayerVisit) => formatDate(new Date(`${visit.clubDay}T12:00:00+05:30`));
// The tier only above the base one, as at the door (audit F-020).
const tierOf = (visit: PlayerVisit) => (visit.isBaseTier ? NONE() : visit.tierName);

/** The tiers the column's menu offers, each with the server's count over the visits the other filters leave. */
const tierChoices = (counted: ListChoices | undefined): readonly ColumnChoice[] => (counted?.['tier'] ?? []).map(({ value, count }) => ({ value, count }));

/** The door's columns (decision 0682), with the day first: the server sorts and filters, as the door's table. */
function visitColumns(counted: ListChoices | undefined): readonly DataTableColumn<PlayerVisit>[] {
  return [
    {
      key: 'date', share: 1, header: t('console.reports.playersReport.date'), cell: (visit) => <Text variant="secondary" tone="muted">{dayOf(visit)}</Text>,
      sortValue: (visit) => visit.clubDay, exportValue: dayOf, filter: false,
    },
    { key: 'player', share: 2, header: t('console.todaysPlayers.name'), cell: (visit) => visit.fullName, sortValue: (visit) => visit.fullName, priority: 'primary', isWide: true, filter: 'text' },
    { key: 'number', share: 0.65, header: t('console.members.number'), cell: (visit) => <Text variant="secondary" tone="muted">{String(visit.memberNumber)}</Text>, sortValue: (visit) => visit.memberNumber, exportValue: (visit) => visit.memberNumber, filter: 'number' },
    { key: 'tier', share: 1.05, header: t('console.members.tier'), cell: tierOf, exportValue: (visit) => visit.tierName, sortValue: (visit) => visit.tierName, filter: 'choice', choices: tierChoices(counted), filterValue: (visit) => visit.tierName },
    { key: 'in', share: 0.65, header: t('console.todaysPlayers.checkedIn'), cell: (visit) => at(visit.checkedInAt), sortValue: (visit) => visit.checkedInAt ?? '', filter: false },
    { key: 'out', share: 0.65, header: t('console.todaysPlayers.checkedOut'), cell: (visit) => at(visit.checkedOutAt), sortValue: (visit) => visit.checkedOutAt ?? '', filter: false },
    { key: 'waited', share: 1, filter: 'duration', header: t('console.todaysPlayers.waited'), cell: (visit) => formatDuration(visit.waitingSeconds), sortValue: (visit) => visit.waitingSeconds, align: 'end' },
    { key: 'table', share: 0.95, header: t('console.todaysPlayers.table'), cell: tablesOf, sortValue: tablesOf, filter: 'text' },
    {
      key: 'played', share: 1.5, filter: 'duration', header: t('console.todaysPlayers.played'), sortValue: (visit) => visit.playedSeconds, align: 'end',
      cell: (visit) => (visit.tables.length === 0 ? NONE() : formatDuration(visit.playedSeconds)),
    },
    // The Bonus given to them that club day (#1062).
    {
      key: 'bonus', share: 1, header: t('console.todaysPlayers.bonus'), align: 'end', filter: false,
      sortValue: (visit) => Number(formatRupeesForFile(visit.bonus)), exportValue: (visit) => Number(formatRupeesForFile(visit.bonus)),
      cell: (visit) => formatChips(visit.bonus),
    },
    {
      key: 'kyc', share: 1.3, header: t('console.members.kyc'), sortValue: (visit) => KYC.indexOf(visit.kycStatus), isWide: true, filter: false,
      cell: (visit) => <DotStatus tone={KYC_TONE[visit.kycStatus]} label={kycWords(visit.kycStatus)} />, exportValue: (visit) => kycWords(visit.kycStatus),
    },
  ];
}

function stateOf(page: ReturnType<typeof usePlayerVisitsPage>) {
  if (page.data !== undefined) return { rows: page.data.rows, emptyText: t('console.reports.playersReport.noVisits') };
  return page.isError ? { status: 'error' as const, onRetry: () => void page.refetch() } : { status: 'loading' as const };
}

/**
 * Every visit in the report's span (the owner, 16 Nov; decision 0682), as the door lists the day's players, with the day
 * first: a page at a time from the server, each column sorted and filtered there, and its own Export of every visit the
 * view leaves.
 */
export function PlayerVisits({ span, periodWords }: { span: ReportSpan; periodWords: string }) {
  // The table's view as it last handed it over; none until it is first drawn.
  const [request, setRequest] = useState<DataTableRequest | null>(null);
  const page = usePlayerVisitsPage(span, request);
  const counted = useListChoices('player_visits', span.venueId, scopedTo(span, request)).data;
  return (
    <DataTable {...stateOf(page)} label={t('console.reports.playersReport.visits')} columns={visitColumns(counted)} narrowLayout="scroll"
      rowKey={(visit) => `${visit.clubDay}:${visit.memberId}`} exportFilter={periodWords}
      filter={{ label: t('console.reports.playersReport.search'), variant: 'subtle', text: (visit) => visit.fullName }}
      server={{ total: page.data?.total ?? 0, pageSize: LIST_PAGE, onRequest: setRequest, scope: `${span.from}:${span.to}` }} exportRows={page.readEvery} />
  );
}

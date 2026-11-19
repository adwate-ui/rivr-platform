import {
  LIST_PAGE, scopedTo, useListChoices, usePlayerVisitsPage, type ListChoices, type MemberKycStatus, type PlayerVisit, type ReportSpan, type VisitTimes,
} from '@rivr/db';
import { formatChips, formatDate, formatDuration, formatRupeesForFile, formatTime, t } from '@rivr/i18n';
import { Button, DataTable, DotStatus, Text, type ColumnChoice, type DataTableColumn, type DataTableRequest, type DotStatusTone } from '@rivr/ui';
import { useState, type ComponentType } from 'react';

/** The panel that corrects a visit (#1075): Bonus approvals' own, which the route hands in. */
export type CorrectVisitPanel = ComponentType<{
  venueId: string; memberId: string; subtitle: string; visits: readonly VisitTimes[]; onDone: () => void; onCancel: () => void;
}>;

// As the door shows an identity check: cream once verified, gold while the club has something to do, red refused.
const KYC_TONE: Readonly<Record<MemberKycStatus, DotStatusTone>> = {
  verified: 'active', in_review: 'needsYou', at_desk: 'needsYou', refused: 'danger', not_done: 'inactive',
};
const KYC: readonly MemberKycStatus[] = ['verified', 'in_review', 'at_desk', 'refused', 'not_done'];

const NONE = () => t('console.todaysPlayers.none');
const at = (iso: string | null) => (iso === null ? NONE() : formatTime(new Date(iso)));
// A wait counts only after check-in, and a row with no seat has no time away (the owner, 19 Nov): none, which is no 0 min.
const duration = (seconds: number | null) => (seconds === null ? NONE() : formatDuration(seconds));
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
      key: 'date', share: 1.2, header: t('console.reports.playersReport.date'), cell: (visit) => <Text variant="secondary" tone="muted">{dayOf(visit)}</Text>,
      sortValue: (visit) => visit.clubDay, exportValue: dayOf, filter: false, priority: 'secondary',
    },
    { key: 'player', share: 2, header: t('console.todaysPlayers.name'), cell: (visit) => visit.fullName, sortValue: (visit) => visit.fullName, priority: 'primary', isWide: true, filter: 'text' },
    { key: 'number', share: 0.65, header: t('console.members.number'), cell: (visit) => <Text variant="secondary" tone="muted">{String(visit.memberNumber)}</Text>, sortValue: (visit) => visit.memberNumber, exportValue: (visit) => visit.memberNumber, filter: 'number' },
    { key: 'tier', share: 1.05, header: t('console.members.tier'), cell: tierOf, exportValue: (visit) => visit.tierName, sortValue: (visit) => visit.tierName, filter: 'choice', choices: tierChoices(counted), filterValue: (visit) => visit.tierName },
    { key: 'in', share: 0.65, header: t('console.todaysPlayers.checkedIn'), cell: (visit) => at(visit.checkedInAt), sortValue: (visit) => visit.checkedInAt ?? '', filter: false },
    { key: 'out', share: 0.65, header: t('console.todaysPlayers.checkedOut'), cell: (visit) => at(visit.checkedOutAt), sortValue: (visit) => visit.checkedOutAt ?? '', filter: false },
    { key: 'waited', share: 1, filter: 'duration', header: t('console.todaysPlayers.waited'), cell: (visit) => duration(visit.waitingSeconds), sortValue: (visit) => visit.waitingSeconds ?? -1, align: 'end' },
    { key: 'table', share: 0.95, header: t('console.todaysPlayers.table'), cell: tablesOf, sortValue: tablesOf, filter: 'text' },
    // A row is a seat (the owner, 19 Nov): when they sat at its table and left it, and its time away.
    { key: 'seated', share: 0.65, header: t('console.todaysPlayers.seated'), cell: (visit) => at(visit.seatedAt), sortValue: (visit) => visit.seatedAt ?? '', filter: false },
    { key: 'left', share: 0.65, header: t('console.todaysPlayers.left'), cell: (visit) => at(visit.leftAt), sortValue: (visit) => visit.leftAt ?? '', filter: false },
    { key: 'away', share: 0.8, filter: 'duration', header: t('console.todaysPlayers.away'), cell: (visit) => duration(visit.awaySeconds), sortValue: (visit) => visit.awaySeconds ?? -1, align: 'end' },
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

/** A super admin's Correct, at the end of each row with a visit to correct (#1075); its column is left out of exports. */
const correctColumn = (onCorrect: (visit: PlayerVisit) => void): DataTableColumn<PlayerVisit> => ({
  key: 'correct', share: 1.1, header: '', align: 'end', filter: false,
  cell: (visit) => (visit.visits.length === 0 ? null : (
    <Button variant="text" size="small" aria-label={t('console.reports.playersReport.correctNamed', { name: visit.fullName, day: dayOf(visit) })}
      onClick={() => onCorrect(visit)}>
      {t('console.reports.playersReport.correct')}
    </Button>
  )),
});

function stateOf(page: ReturnType<typeof usePlayerVisitsPage>) {
  if (page.data !== undefined) return { rows: page.data.rows, emptyText: t('console.reports.playersReport.noVisits') };
  return page.isError ? { status: 'error' as const, onRetry: () => void page.refetch() } : { status: 'loading' as const };
}

/**
 * Every visit in the report's span (the owner, 16 Nov; decision 0682), as the door lists the day's players, with the day
 * first: a page at a time from the server, each column sorted and filtered there, and its own Export of every visit the
 * view leaves. A super admin corrects a visit's times from its row (#1075, the owner, 18 Nov), in the panel Bonus approvals
 * uses (`correct`, only for them).
 */
export function PlayerVisits({ span, periodWords, correct: Correct }: { span: ReportSpan; periodWords: string; correct?: CorrectVisitPanel | undefined }) {
  // The table's view as it last handed it over; none until it is first drawn.
  const [request, setRequest] = useState<DataTableRequest | null>(null);
  const [correcting, setCorrecting] = useState<PlayerVisit | null>(null);
  const page = usePlayerVisitsPage(span, request);
  const counted = useListChoices('player_visits', span.venueId, scopedTo(span, request)).data;
  const columns = Correct === undefined ? visitColumns(counted) : [...visitColumns(counted), correctColumn(setCorrecting)];
  return (
    <>
      <DataTable {...stateOf(page)} label={t('console.reports.playersReport.visits')} columns={columns} narrowLayout="sideways"
        rowKey={(visit) => `${visit.clubDay}:${visit.memberId}:${visit.seatedAt ?? ''}`} exportFilter={periodWords}
        filter={{ label: t('console.reports.playersReport.search'), variant: 'subtle', text: (visit) => visit.fullName }}
        server={{ total: page.data?.total ?? 0, pageSize: LIST_PAGE, onRequest: setRequest, scope: `${span.from}:${span.to}` }} exportRows={page.readEvery} />
      {Correct === undefined || correcting === null ? null : (
        <Correct venueId={span.venueId} memberId={correcting.memberId} visits={correcting.visits}
          subtitle={t('console.reports.playersReport.correction', { name: correcting.fullName, day: dayOf(correcting) })}
          onDone={() => setCorrecting(null)} onCancel={() => setCorrecting(null)} />
      )}
    </>
  );
}

import type { VenueTournament } from '@rivr/db';
import { formatDayTime, t } from '@rivr/i18n';
import { Button, DataTable, type DataTableColumn } from '@rivr/ui';
import { eventLine } from './eventLine.ts';

/** Where a tournament stands: finished, running, paused, not shown to members, or when it starts. */
function statusOf(tournament: VenueTournament): string {
  if (tournament.finishedAt !== null) return t('console.tournaments.payouts.finishedStatus');
  if (tournament.clock !== null) return t(tournament.clock.isRunning ? 'console.tournaments.running' : 'console.tournaments.paused');
  return tournament.isPublished ? t('console.tournaments.notStarted') : t('console.tournaments.offCalendar');
}

interface TournamentListProps {
  tournaments: readonly VenueTournament[];
  chosenId: string | undefined;
  onChoose: (tournamentId: string) => void;
}

/** The venue's tournaments from today on, the running first, each opened onto the clock. */
export function TournamentList({ tournaments, chosenId, onChoose }: TournamentListProps) {
  const columns: DataTableColumn<VenueTournament>[] = [
    { key: 'name', header: t('console.tournaments.name'), cell: (row) => row.name },
    { key: 'starts', header: t('console.tournaments.starts'), cell: (row) => formatDayTime(new Date(row.startsAt)) },
    { key: 'status', header: t('console.tournaments.status'), cell: statusOf },
    { key: 'event', header: t('console.tournaments.event'), cell: (row) => eventLine(row, tournaments) ?? '' },
    {
      key: 'open', header: t('console.tournaments.open'), align: 'end',
      cell: (row) => (
        <Button variant="text" isDisabled={row.id === chosenId} aria-label={t('console.tournaments.openName', { name: row.name })}
          onClick={() => onChoose(row.id)}>{t('console.tournaments.open')}</Button>
      ),
    },
  ];
  return <DataTable label={t('console.tournaments.list')} columns={columns} rowKey={(row) => row.id} rows={tournaments}
    emptyText={t('console.tournaments.none')} />;
}

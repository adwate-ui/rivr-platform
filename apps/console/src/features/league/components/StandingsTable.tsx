import { useVenueLeague, type LeagueStanding } from '@rivr/db';
import { formatNumber, t } from '@rivr/i18n';
import { DataTable, type DataTableColumn } from '@rivr/ui';

function columns(): readonly DataTableColumn<LeagueStanding>[] {
  return [
    { key: 'place', header: t('console.league.place'), cell: (row) => formatNumber(row.place), sortValue: (row) => row.place },
    {
      key: 'member', header: t('console.league.member'), sortValue: (row) => row.fullName,
      cell: (row) => t('console.league.memberLine', { name: row.fullName, number: row.memberNumber }),
    },
    { key: 'cash', header: t('console.league.cash'), align: 'end', cell: (row) => formatNumber(row.cashPoints), sortValue: (row) => row.cashPoints },
    {
      key: 'tournaments', header: t('console.league.tournaments'), align: 'end', cell: (row) => formatNumber(row.tournamentPoints),
      sortValue: (row) => row.tournamentPoints,
    },
    { key: 'total', header: t('console.league.total'), align: 'end', cell: (row) => formatNumber(row.points), sortValue: (row) => row.points },
  ];
}

/** The standings over the League months from `firstMonth` to `lastMonth` (`2026-11-01`): place, member, cash, tournaments and total. */
export function StandingsTable({ venueId, label, firstMonth, lastMonth }: { venueId: string; label: string; firstMonth: string; lastMonth: string }) {
  const standings = useVenueLeague(venueId, firstMonth, lastMonth);
  const base = { label, columns: columns(), rowKey: (row: LeagueStanding) => row.memberId };
  if (standings.data === undefined && standings.isError) return <DataTable {...base} status="error" onRetry={() => void standings.refetch()} />;
  if (standings.data === undefined) return <DataTable {...base} status="loading" />;
  return (
    <DataTable {...base} rows={standings.data} emptyText={t('console.league.noStandings')}
      filter={{ label: t('console.league.member'), text: (row) => row.fullName }} />
  );
}

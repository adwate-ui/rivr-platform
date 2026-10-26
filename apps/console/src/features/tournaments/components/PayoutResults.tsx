import { useTournamentPayouts, type TournamentPayout, type VenueTournament } from '@rivr/db';
import { formatMoney, t } from '@rivr/i18n';
import { DataTable, Stack, Text, type DataTableColumn } from '@rivr/ui';

/** The table's columns, in the console's language. */
const payoutColumns = (): DataTableColumn<TournamentPayout>[] => [
  { key: 'place', header: t('console.tournaments.payouts.place'),
    cell: (row) => (row.kind === 'bounty' || row.place === null ? t('console.tournaments.payouts.bounty') : String(row.place)) },
  { key: 'player', header: t('console.tournaments.payouts.player'),
    cell: (row) => (row.entryNumber > 1 ? t('console.tournaments.playerEntry', { name: row.fullName, number: row.entryNumber }) : row.fullName) },
  { key: 'prize', header: t('console.tournaments.payouts.prize'), align: 'end', cell: (row) => formatMoney(row.prize) },
  { key: 'bounty', header: t('console.tournaments.payouts.bounty'), align: 'end', cell: (row) => formatMoney(row.bounty) },
  { key: 'tds', header: t('console.tournaments.payouts.tds'), align: 'end',
    cell: (row) => (row.isTdsShadow && row.tds > 0n ? t('console.tournaments.payouts.tdsShadow', { amount: formatMoney(row.tds) }) : formatMoney(row.tds)) },
];

/**
 * What the tournament paid (#117, #121): the bounties as busts paid them, and once it finished every prize
 * by place; each with its TDS, withheld (the wallet got the rest) or shadow.
 */
export function PayoutResults({ tournament }: { tournament: VenueTournament }) {
  const payouts = useTournamentPayouts(tournament.id);
  const label = t('console.tournaments.payouts.paidLabel');
  if (payouts.isPending) return <DataTable label={label} columns={[]} rowKey={() => ''} status="loading" />;
  if (payouts.data === undefined) return <DataTable label={label} columns={[]} rowKey={() => ''} status="error" onRetry={() => void payouts.refetch()} />;
  return (
    <Stack gap={3}>
      {tournament.finishedAt === null ? null : <Text>{t('console.tournaments.payouts.finished')}</Text>}
      {tournament.overlay !== null && tournament.overlay > 0n
        ? <Text>{t('console.tournaments.payouts.overlayPaid', { amount: formatMoney(tournament.overlay) })}</Text> : null}
      <DataTable label={label} columns={payoutColumns()} rowKey={(row) => row.id} rows={payouts.data} emptyText={t('console.tournaments.payouts.noPayouts')} />
    </Stack>
  );
}

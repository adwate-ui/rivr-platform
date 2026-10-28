import { useSatelliteTickets } from '@rivr/db';
import { formatMoney, t } from '@rivr/i18n';
import { Heading, LoadState, Stack, Text } from '@rivr/ui';

const STATUSES = ['held', 'used', 'refunded'] as const;

/** The tickets a finished satellite issued (#519), by place: who won each, its value, and where it stands. */
export function SatelliteTickets({ tournamentId }: { tournamentId: string }) {
  const tickets = useSatelliteTickets(tournamentId);
  return (
    <Stack gap={2}>
      <Heading level={3} variant="subsection">{t('console.tournaments.payouts.tickets')}</Heading>
      {tickets.isPending ? <LoadState /> : null}
      {tickets.isError ? (
        <LoadState isError errorText={t('console.tournaments.payouts.failures.unavailable')} onRetry={() => void tickets.refetch()} />
      ) : null}
      {tickets.data?.length === 0 ? <Text tone="muted">{t('console.tournaments.payouts.noTickets')}</Text> : null}
      {tickets.data?.map((ticket, index) => (
        <Text key={`${ticket.fullName}-${String(index)}`}>{t('console.tournaments.payouts.ticketLine', {
          name: ticket.fullName, amount: formatMoney(ticket.value),
          status: t(`console.tournaments.payouts.ticketStatuses.${STATUSES.find((each) => each === ticket.status) ?? 'held'}`),
        })}</Text>
      ))}
    </Stack>
  );
}

import { useTournamentPayoutActions, useTournamentSeating, type VenueTournament } from '@rivr/db';
import { t } from '@rivr/i18n';
import { ErrorMessage, Heading, LoadState, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { ChipCountForm } from './ChipCountForm.tsx';

/**
 * Bagging a Day 1 flight (#524, decision 0251): each player left's chips, with which they go through to Day 2.
 * Day 2's payouts are asked for first, and a full Day 2 room or an alternate waiting is explained.
 */
export function BagForm({ venueId, flight, dayTwo }: { venueId: string; flight: VenueTournament; dayTwo: VenueTournament | undefined }) {
  const seating = useTournamentSeating(flight.id);
  const { bag } = useTournamentPayoutActions(venueId, flight.id);
  const [failure, setFailure] = useState<string | null>(null);
  if (seating.isPending) return <LoadState />;
  if (seating.data === undefined) {
    return (
      <LoadState isError errorText={t('console.tournaments.payouts.failures.unavailable')} onRetry={() => void seating.refetch()} />
    );
  }
  const left = seating.data.filter((row) => row.status === 'seated');
  return (
    <Stack gap={3}>
      <Heading level={3} variant="subsection">{t('console.tournaments.payouts.bagTitle')}</Heading>
      {dayTwo !== undefined && dayTwo.payoutShares === null
        ? <Text>{t('console.tournaments.payouts.setDayTwoPayouts', { name: dayTwo.name })}</Text> : null}
      {flight.clock === null ? <Text tone="muted">{t('console.tournaments.payouts.bagNotReady')}</Text> : (
        <ChipCountForm key={left.map((row) => row.entryId).join()} left={left} hint={t('console.tournaments.payouts.bagHint')}
          label={t('console.tournaments.payouts.bag')} confirm={t('console.tournaments.payouts.confirmBag')} isBusy={bag.isPending}
          onCount={(stacks) => void bag.mutateAsync(stacks)
            .then((done) => setFailure(done.ok ? null : t(`console.tournaments.payouts.failures.${done.error}`)))} />
      )}
      {failure === null ? null : <ErrorMessage>{failure}</ErrorMessage>}
    </Stack>
  );
}

import { zodResolver } from '@hookform/resolvers/zod';
import { istMoment, istParts, publishTournamentSchema } from '@rivr/contracts/tournaments';
import { usePublishedTournamentActions, type PublishedTournament, type TournamentInterestFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Stack } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { ListingFields, type ListingValues } from './PublishTournament.tsx';

/** A published tournament's details to correct, as they stand (F-027). */
export function EditTournament({ venueId, tournament, onDone }: { venueId: string; tournament: PublishedTournament; onDone: () => void }) {
  const { edit } = usePublishedTournamentActions(venueId);
  const [failure, setFailure] = useState<TournamentInterestFailure | null>(null);
  const [resolver] = useState(() => zodResolver(publishTournamentSchema));
  const { name, game, stake, description } = tournament;
  const form = useForm<ListingValues, unknown, z.output<typeof publishTournamentSchema>>({ resolver, defaultValues: { name, game, stake, description, ...istParts(new Date(tournament.startsAt)) } });
  const submit = form.handleSubmit(async ({ day, time, ...listing }) => {
    const done = await edit.mutateAsync({ tournamentId: tournament.tournamentId, listing: { ...listing, startsAt: istMoment(day, time) } });
    setFailure(done.ok ? null : done.error);
    if (done.ok) onDone();
  });
  return (
    <Stack gap={4}>
      <ListingFields form={form} />
      <Inline gap={2}>
        <Button variant="primary" size="compact" isLoading={edit.isPending} onClick={() => void submit()}>{t('console.tournamentInterest.save')}</Button>
        <Button variant="text" size="compact" onClick={onDone}>{t('console.tournamentInterest.cancelEdit')}</Button>
      </Inline>
      {failure === null ? null : <ErrorMessage>{t(`console.tournamentInterest.publish.failures.${failure}`)}</ErrorMessage>}
    </Stack>
  );
}

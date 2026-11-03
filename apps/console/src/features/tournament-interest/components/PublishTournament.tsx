import { zodResolver } from '@hookform/resolvers/zod';
import { istMoment, publishTournamentSchema } from '@rivr/contracts/tournaments';
import { usePublishTournament } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, Input, Stack, StatusMessage, TextArea } from '@rivr/ui';
import { useState } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';

type ListingValues = z.input<typeof publishTournamentSchema>;
type ListingForm = UseFormReturn<ListingValues, unknown, z.output<typeof publishTournamentSchema>>;

const EMPTY: ListingValues = { name: '', day: '', time: '', game: '', stake: '', description: '' };

/** The name, the IST day and start, the game and stake as text, and a description: no field for money. */
function Fields({ form }: { form: ListingForm }) {
  const errors = form.formState.errors;
  const fields = {
    name: form.register('name'), day: form.register('day'), time: form.register('time'), game: form.register('game'),
    stake: form.register('stake'), description: form.register('description'),
  };
  return (
    <>
      <Input {...fields.name} label={t('console.tournamentInterest.publish.name')} autoComplete="off"
        error={errors.name ? t('console.tournamentInterest.publish.invalidName') : undefined} />
      <Inline gap={4} align="start" wrap>
        <Input {...fields.day} type="date" label={t('console.tournamentInterest.publish.day')}
          error={errors.day ? t('console.tournamentInterest.publish.invalidDay') : undefined} />
        <Input {...fields.time} label={t('console.tournamentInterest.publish.time')} hint={t('console.tournamentInterest.publish.timeHint')}
          inputMode="numeric" autoComplete="off" error={errors.time ? t('console.tournamentInterest.publish.invalidTime') : undefined} />
      </Inline>
      <Inline gap={4} align="start" wrap>
        <Input {...fields.game} label={t('console.tournamentInterest.publish.game')} autoComplete="off"
          error={errors.game ? t('console.tournamentInterest.publish.invalidGame') : undefined} />
        <Input {...fields.stake} label={t('console.tournamentInterest.publish.stake')} autoComplete="off"
          error={errors.stake ? t('console.tournamentInterest.publish.invalidStake') : undefined} />
      </Inline>
      <TextArea {...fields.description} label={t('console.tournamentInterest.publish.description')} rows={3}
        error={errors.description ? t('console.tournamentInterest.publish.invalidDescription') : undefined} />
    </>
  );
}

/**
 * Publishes an upcoming tournament without money (#800; decision 0441), for staff who manage tournaments: members see it
 * in the app at once, and register interest, as for any published tournament.
 */
export function PublishTournament({ venueId }: { venueId: string }) {
  const publish = usePublishTournament(venueId);
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);
  const [resolver] = useState(() => zodResolver(publishTournamentSchema));
  const form = useForm<ListingValues, unknown, z.output<typeof publishTournamentSchema>>({ resolver, defaultValues: EMPTY });
  const submit = form.handleSubmit(async ({ day, time, ...listing }) => {
    const done = await publish.mutateAsync({ ...listing, startsAt: istMoment(day, time) });
    setOutcome(done.ok ? { ok: true, text: t('console.tournamentInterest.publish.published', { name: listing.name }) }
      : { ok: false, text: t(`console.tournamentInterest.publish.failures.${done.error}`) });
    if (done.ok) form.reset(EMPTY);
  });
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.tournamentInterest.publish.heading')}</Heading>
      <Fields form={form} />
      <Inline gap={4} align="center">
        <Button variant="primary" isLoading={publish.isPending} onClick={() => void submit()}>{t('console.tournamentInterest.publish.publish')}</Button>
        <StatusMessage>{outcome?.ok === true ? outcome.text : null}</StatusMessage>
      </Inline>
      {outcome?.ok === false ? <ErrorMessage>{outcome.text}</ErrorMessage> : null}
    </Stack>
  );
}

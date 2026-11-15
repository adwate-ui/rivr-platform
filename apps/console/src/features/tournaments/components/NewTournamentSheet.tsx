import { zodResolver } from '@hookform/resolvers/zod';
import { istMoment, newTournamentSchema } from '@rivr/contracts/tournaments';
import { useTournamentActions } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Grid, Inline, Input, Sheet, Stack, useToast } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm, type UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';

type Values = z.input<typeof newTournamentSchema>;
type NewForm = UseFormReturn<Values, unknown, z.output<typeof newTournamentSchema>>;

const GAMES = ['nlh', 'plo'] as const;

/** The name, the IST day and start, and the game, picked from the club's two: no field for money. */
function Fields({ form }: { form: NewForm }) {
  const errors = form.formState.errors;
  const fields = { name: form.register('name'), day: form.register('day'), time: form.register('time') };
  const games = GAMES.map((game) => ({ value: t(`console.tournaments.games.${game}`), label: t(`console.tournaments.games.${game}`) }));
  return (
    <>
      <Input {...fields.name} label={t('console.tournaments.form.name')} autoComplete="off" maxLength={80}
        error={errors.name ? t('console.tournaments.form.invalidName') : undefined} />
      <Grid columns={2} gap={4}>
        <Input {...fields.day} type="date" label={t('console.tournaments.form.day')} error={errors.day ? t('console.tournaments.form.invalidDay') : undefined} />
        <Input {...fields.time} label={t('console.tournaments.form.time')} hint={t('console.tournaments.form.timeHint')} inputMode="numeric" autoComplete="off"
          error={errors.time ? t('console.tournaments.form.invalidTime') : undefined} />
      </Grid>
      <Controller control={form.control} name="game" render={({ field }) => (
        <ChoiceChips label={t('console.tournaments.form.game')} mode="one" look="subtle" options={games} selected={[field.value]}
          onChange={(picked) => field.onChange(picked[0] ?? field.value)} />
      )} />
    </>
  );
}

/**
 * A new tournament in the panel at the side (redesign RD-26): its name, its IST day and start, and its game, with nowhere
 * for money. Created, members see it in the app at once; it says so in a toast and closes. Refused, it says why.
 */
export function NewTournamentSheet({ venueId, onClose }: { venueId: string; onClose: () => void }) {
  const { create } = useTournamentActions(venueId);
  const toast = useToast();
  const [failure, setFailure] = useState<string | null>(null);
  const [resolver] = useState(() => zodResolver(newTournamentSchema));
  const form: NewForm = useForm({ resolver, defaultValues: { name: '', day: '', time: '', game: t('console.tournaments.games.nlh') } });
  const submit = form.handleSubmit(async ({ name, day, time, game }) => {
    const done = await create.mutateAsync({ name, startsAt: istMoment(day, time), game });
    setFailure(done.ok ? null : t(`console.tournaments.failures.${done.error}`));
    if (!done.ok) return;
    toast(t('console.tournaments.form.created', { name }));
    onClose();
  });
  const footer = (
    <Inline gap={2} justify="end">
      <Button variant="text" size="compact" onClick={onClose}>{t('common.cancel')}</Button>
      <Button variant="primary" size="compact" isLoading={create.isPending} onClick={() => void submit()}>{t('console.tournaments.form.create')}</Button>
    </Inline>
  );
  return (
    <Sheet place="console" isOpen onClose={onClose} title={t('console.tournaments.newTournament')} footer={footer}>
      <Stack gap={5}>
        <Fields form={form} />
        {failure === null ? null : <ErrorMessage>{failure}</ErrorMessage>}
      </Stack>
    </Sheet>
  );
}

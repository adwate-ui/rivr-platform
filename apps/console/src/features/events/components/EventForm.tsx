import { zodResolver } from '@hookform/resolvers/zod';
import { CLUB_EVENT_KINDS, newClubEventSchema } from '@rivr/contracts/clubEvents';
import { istMoment } from '@rivr/contracts/tournaments';
import { useAddClubEvent } from '@rivr/db/clubEvents';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Heading, Inline, Input, Stack, StatusMessage } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';

type EventValues = z.input<typeof newClubEventSchema>;
const EMPTY: EventValues = { kind: 'pro_night', title: '', day: '', time: '', seats: '', details: '' };

/** A new pro night or corporate table (#143): its title, the IST day and time it starts, its seats and any details. */
export function EventForm({ venueId }: { venueId: string }) {
  const add = useAddClubEvent(venueId);
  const [resolver] = useState(() => zodResolver(newClubEventSchema));
  const form = useForm<EventValues, unknown, z.output<typeof newClubEventSchema>>({ resolver, defaultValues: EMPTY });
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);
  const submit = form.handleSubmit(async (values) => {
    const done = await add.mutateAsync({ kind: values.kind, title: values.title, startsAt: istMoment(values.day, values.time), seats: values.seats, details: values.details });
    setOutcome(done.ok ? { ok: true, text: t('console.events.added', { title: values.title }) } : { ok: false, text: t(`console.events.failures.${done.error}`) });
    if (done.ok) form.reset(EMPTY);
  });
  const fields = { title: form.register('title'), day: form.register('day'), time: form.register('time'), seats: form.register('seats'), details: form.register('details') };
  return (
    <Stack gap={4}>
      <Heading level={2} variant="section">{t('console.events.addTitle')}</Heading>
      <Controller control={form.control} name="kind" render={({ field }) => (
        <ChoiceChips label={t('console.events.kind')} mode="one" selected={[field.value]}
          options={CLUB_EVENT_KINDS.map((kind) => ({ value: kind, label: t(`console.events.kinds.${kind}`) }))}
          onChange={(chosen) => { if (chosen[0] !== undefined) field.onChange(chosen[0]); }} />
      )} />
      <Input {...fields.title} label={t('console.events.eventTitle')} autoComplete="off" />
      <Inline gap={4} align="start" wrap>
        <Input {...fields.day} type="date" label={t('console.events.day')} />
        <Input {...fields.time} label={t('console.events.time')} hint={t('console.events.timeHint')} inputMode="numeric" autoComplete="off" />
        <Input {...fields.seats} label={t('console.events.seats')} inputMode="numeric" autoComplete="off" />
      </Inline>
      <Input {...fields.details} label={t('console.events.details')} autoComplete="off" />
      {Object.keys(form.formState.errors).length > 0 ? <ErrorMessage>{t('console.events.invalid')}</ErrorMessage> : null}
      <Button variant="secondary" isLoading={add.isPending} onClick={() => void submit()}>{t('console.events.add')}</Button>
      <StatusMessage>{outcome?.ok === true ? outcome.text : null}</StatusMessage>
      {outcome?.ok === false ? <ErrorMessage>{outcome.text}</ErrorMessage> : null}
    </Stack>
  );
}

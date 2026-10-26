import { zodResolver } from '@hookform/resolvers/zod';
import { istMoment, newTournamentSchema } from '@rivr/contracts/tournaments';
import { useTournamentActions, type TournamentTemplate } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Heading, Inline, Input, Stack, Switch, Text } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm, type UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';

type NewValues = z.input<typeof newTournamentSchema>;
type NewFormApi = UseFormReturn<NewValues, unknown, z.output<typeof newTournamentSchema>>;

const EMPTY: NewValues = { templateId: '', name: '', day: '', time: '', isPublished: true };

/** The template, chosen from the venue's; choosing one names the tournament after it until a name is typed. */
function TemplateChoice({ form, templates }: { form: NewFormApi; templates: readonly TournamentTemplate[] }) {
  const error = form.formState.errors.templateId === undefined ? undefined : t('console.tournaments.chooseTemplate');
  return (
    <Controller control={form.control} name="templateId" render={({ field }) => (
      <Stack gap={2}>
        <ChoiceChips label={t('console.tournaments.template')} mode="one" selected={field.value === '' ? [] : [field.value]}
          options={templates.map((template) => ({ value: template.id, label: template.name }))}
          onChange={(chosen) => {
            const template = templates.find((each) => each.id === chosen[0]);
            field.onChange(template?.id ?? '');
            if (template !== undefined && form.getValues('name') === '') form.setValue('name', template.name);
          }} />
        {error === undefined ? null : <ErrorMessage>{error}</ErrorMessage>}
      </Stack>
    )} />
  );
}

/** The name, the IST day and time it starts, and whether members see it. */
function Fields({ form }: { form: NewFormApi }) {
  const errors = form.formState.errors;
  const fields = { name: form.register('name'), day: form.register('day'), time: form.register('time') };
  return (
    <>
      <Input {...fields.name} label={t('console.tournaments.name')} autoComplete="off"
        error={errors.name ? t('console.tournaments.invalidName') : undefined} />
      <Inline gap={4} align="start" wrap>
        <Input {...fields.day} type="date" label={t('console.tournaments.day')} error={errors.day ? t('console.tournaments.invalidDay') : undefined} />
        <Input {...fields.time} label={t('console.tournaments.time')} hint={t('console.tournaments.timeHint')} inputMode="numeric" autoComplete="off"
          error={errors.time ? t('console.tournaments.invalidTime') : undefined} />
      </Inline>
      <Controller control={form.control} name="isPublished" render={({ field }) => (
        <Switch label={t('console.tournaments.shown')} hint={t('console.tournaments.shownHint')} isOn={field.value} onChange={field.onChange} />
      )} />
    </>
  );
}

/** Makes a tournament from a template (#115): everything else, the levels included, comes from the template. */
export function NewTournamentForm({ venueId, templates, onMade }: { venueId: string; templates: readonly TournamentTemplate[]; onMade: (id: string) => void }) {
  const { create } = useTournamentActions(venueId);
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);
  const [resolver] = useState(() => zodResolver(newTournamentSchema));
  const form = useForm<NewValues, unknown, z.output<typeof newTournamentSchema>>({ resolver, defaultValues: EMPTY });
  const submit = form.handleSubmit(async (values) => {
    const made = await create.mutateAsync({ templateId: values.templateId, name: values.name, startsAt: istMoment(values.day, values.time), isPublished: values.isPublished });
    setOutcome(made.ok ? { ok: true, text: t('console.tournaments.made', { name: values.name }) } : { ok: false, text: t(`console.tournaments.failures.${made.error}`) });
    if (!made.ok) return;
    form.reset(EMPTY);
    onMade(made.value);
  });
  return (
    <Stack gap={4}>
      <Heading level={2} variant="section">{t('console.tournaments.newTournament')}</Heading>
      {templates.length === 0 ? <Text tone="muted">{t('console.tournaments.noTemplates')}</Text> : (
        <>
          <TemplateChoice form={form} templates={templates} />
          <Fields form={form} />
          <Inline gap={4} align="center">
            <Button variant="secondary" isLoading={create.isPending} onClick={() => void submit()}>{t('console.tournaments.make')}</Button>
            {outcome?.ok === true ? <Text>{outcome.text}</Text> : null}
          </Inline>
        </>
      )}
      {outcome?.ok === false ? <ErrorMessage>{outcome.text}</ErrorMessage> : null}
    </Stack>
  );
}

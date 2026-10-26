import { zodResolver } from '@hookform/resolvers/zod';
import { TOURNAMENT_FORMATS, tournamentTemplateSchema } from '@rivr/contracts/tournaments';
import { useTournamentSetupActions, type BlindStructure, type TournamentTemplate } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';
import { ChoiceChips, Heading, Inline, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm, type UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';
import { SaveRow, type SaveOutcome } from './SaveRow.tsx';
import { emptyTemplate, templateOrder, templateValues, type TemplateValues } from './templateValues.ts';

type TemplateFormApi = UseFormReturn<TemplateValues, unknown, z.output<typeof tournamentTemplateSchema>>;
type FieldName = Exclude<keyof TemplateValues, 'format' | 'structureId'>;

/** Each typed field: its label, its hint, what it says when wrong, and whether it is rupees. */
const FIELDS: readonly { name: FieldName; label: MessageKey; hint?: MessageKey; error: MessageKey; isRupees?: boolean }[] = [
  { name: 'buyIn', label: 'console.tournaments.buyInLabel', error: 'console.tournaments.invalidAmount', isRupees: true },
  { name: 'fee', label: 'console.tournaments.fee', hint: 'console.tournaments.feeHint', error: 'console.tournaments.invalidFee', isRupees: true },
  { name: 'startingStack', label: 'console.tournaments.stack', error: 'console.tournaments.invalidWhole' },
  { name: 'lastRegistrationLevel', label: 'console.tournaments.lastLevel', hint: 'console.tournaments.lastLevelHint', error: 'console.tournaments.invalidWhole' },
  { name: 'maxBuys', label: 'console.tournaments.maxBuys', hint: 'console.tournaments.maxBuysHint', error: 'console.tournaments.invalidMaxBuys' },
  { name: 'placesPaid', label: 'console.tournaments.places', error: 'console.tournaments.invalidPlaces' },
  { name: 'guarantee', label: 'console.tournaments.guaranteeLabel', hint: 'console.tournaments.guaranteeHint', error: 'console.tournaments.invalidAmount', isRupees: true },
  { name: 'addOn', label: 'console.tournaments.addOn', hint: 'console.tournaments.addOnHint', error: 'console.tournaments.invalidAddOn', isRupees: true },
  { name: 'addOnFee', label: 'console.tournaments.addOnFee', error: 'console.tournaments.invalidAddOnFee', isRupees: true },
  { name: 'addOnChips', label: 'console.tournaments.addOnChips', error: 'console.tournaments.invalidWhole' },
];

/** The format and the blind structure, each chosen from its list. */
function Choices({ form, structures }: { form: TemplateFormApi; structures: readonly BlindStructure[] }) {
  return (
    <>
      <Controller control={form.control} name="format" render={({ field }) => (
        <ChoiceChips label={t('console.tournaments.format')} mode="one" selected={[field.value]}
          options={TOURNAMENT_FORMATS.map((format) => ({ value: format, label: t(`console.tournaments.formats.${format}`) }))}
          onChange={(chosen) => { if (chosen[0] !== undefined) field.onChange(chosen[0]); }} />
      )} />
      <Controller control={form.control} name="structureId" render={({ field }) => (
        <ChoiceChips label={t('console.tournaments.structure')} mode="one" selected={[field.value]}
          options={structures.map((structure) => ({ value: structure.id, label: structure.name }))}
          onChange={(chosen) => { if (chosen[0] !== undefined) field.onChange(chosen[0]); }} />
      )} />
    </>
  );
}

function Fields({ form }: { form: TemplateFormApi }) {
  const errors = form.formState.errors;
  const name = form.register('name');
  return (
    <>
      <Input {...name} label={t('console.tournaments.name')} autoComplete="off" error={errors.name ? t('console.tournaments.invalidName') : undefined} />
      <Inline gap={4} align="start" wrap>
        {FIELDS.map((field) => (
          <Input key={field.name} {...form.register(field.name)} label={t(field.label)} hint={field.hint === undefined ? undefined : t(field.hint)}
            prefix={field.isRupees === true ? t('console.tournaments.rupee') : undefined} inputMode="numeric" autoComplete="off" error={errors[field.name] ? t(field.error) : undefined} />
        ))}
      </Inline>
    </>
  );
}

interface TemplateFormProps {
  venueId: string;
  template: TournamentTemplate | null;
  structures: readonly BlindStructure[];
  onDone: () => void;
}

/** Adds a tournament template, or changes the one chosen (#115, #116). `onDone` runs once a change is saved or cancelled. */
export function TemplateForm({ venueId, template, structures, onDone }: TemplateFormProps) {
  const { saveTemplate } = useTournamentSetupActions(venueId);
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null);
  const [resolver] = useState(() => zodResolver(tournamentTemplateSchema));
  const empty = emptyTemplate(structures[0]?.id ?? '');
  const form = useForm<TemplateValues, unknown, z.output<typeof tournamentTemplateSchema>>({ resolver, defaultValues: template === null ? empty : templateValues(template) });
  const submit = form.handleSubmit(async (values) => {
    const saved = await saveTemplate.mutateAsync(templateOrder(values, template?.id ?? null));
    if (!saved.ok) return setOutcome({ ok: false, text: t(`console.tournaments.failures.${saved.error}`) });
    setOutcome({ ok: true, text: t('console.tournaments.saved', { name: values.name }) });
    if (template === null) form.reset(empty);
    else onDone();
  });
  if (structures.length === 0) return <Text tone="muted">{t('console.tournaments.noStructures')}</Text>;
  const heading = template === null ? t('console.tournaments.newTemplate') : t('console.tournaments.editTemplate', { name: template.name });
  return (
    <Stack gap={4}>
      <Heading level={2} variant="section">{heading}</Heading>
      <Choices form={form} structures={structures} />
      <Fields form={form} />
      <SaveRow isSaving={saveTemplate.isPending} onSave={() => void submit()} onCancel={template === null ? undefined : onDone} outcome={outcome} />
    </Stack>
  );
}

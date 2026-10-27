import { useSettingActions, type SettingFailure, type SettingValue, type VenueSetting } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Grid, Heading, Inline, Input, Stack, StatusMessage } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm, useWatch, type FieldErrors, type Resolver, type UseFormReturn } from 'react-hook-form';
import { FieldInput, type FieldDraft } from './FieldInput.tsx';
import { settingFailureText } from './settingsCopy.ts';
import { draftsFrom, readValue } from './valueDraft.ts';

type When = 'now' | 'date';

/** The form as typed: each field's draft, when it takes effect, and why. */
interface ValueFormValues {
  drafts: Record<string, FieldDraft>;
  when: When;
  date: string;
  reason: string;
}

/** The form as saved: the value, from now (null) or a moment, and why. */
interface ValueFormOutput {
  value: SettingValue;
  effectiveFrom: string | null;
  reason: string;
}

// Today's date on the club's clock, as a date field gives it: 2026-10-20.
const IST_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });

/** From now (null), or from midnight IST on a later day; undefined when the day is not a later one. */
function startFrom(when: When, date: string): string | null | undefined {
  if (when === 'now') return null;
  // A later day only: today's midnight has passed, and the database refuses the past.
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && date > IST_DAY.format(new Date()) ? `${date}T00:00:00+05:30` : undefined;
}

/** The form's check: the value by its key's schema (readValue), a later day, and a reason of 1 to 200 characters. */
function resolverFor(setting: VenueSetting): Resolver<ValueFormValues, unknown, ValueFormOutput> {
  return (values) => {
    const read = readValue(setting.key, setting.fields, values.drafts);
    const effectiveFrom = startFrom(values.when, values.date);
    const reason = values.reason.trim();
    const errors: FieldErrors<ValueFormValues> = {};
    if ('invalid' in read) errors.drafts = Object.fromEntries(read.invalid.map((name) => [name, { type: 'value', message: '' }]));
    if (effectiveFrom === undefined) errors.date = { type: 'date', message: '' };
    if (reason === '' || reason.length > 200) errors.reason = { type: 'reason', message: '' };
    if ('invalid' in read || effectiveFrom === undefined || errors.reason) return { values: {}, errors };
    return { values: { value: read.value, effectiveFrom, reason }, errors: {} };
  };
}

const draftPath = (name: string) => `drafts.${name}` as const;

type Form = UseFormReturn<ValueFormValues, unknown, ValueFormOutput>;

/** Each field of the value, as its schema gives it. */
function SettingFields({ form, setting, tiers, onEdit }: { form: Form; setting: VenueSetting; tiers: ValueFormProps['tiers']; onEdit: () => void }) {
  const invalid = form.formState.errors.drafts ?? {};
  return (
    <Grid columns={3} gap={4}>
      {setting.fields.map((field) => (
        <Controller key={field.name} control={form.control} name={draftPath(field.name)} render={({ field: draft }) => (
          <FieldInput field={field} draft={draft.value} isInvalid={invalid[field.name] !== undefined} tiers={tiers}
            onChange={(next) => { onEdit(); draft.onChange(next); }} />
        )} />
      ))}
    </Grid>
  );
}

/** When the change takes effect: now, or from a later day. */
function WhenField({ form }: { form: Form }) {
  const when = useWatch({ control: form.control, name: 'when' });
  const date = form.register('date');
  return (
    <Stack gap={3}>
      <Controller control={form.control} name="when" render={({ field }) => (
        <ChoiceChips label={t('console.settings.when')} mode="one" selected={[field.value]}
          options={[{ value: 'now', label: t('console.settings.now') }, { value: 'date', label: t('console.settings.fromDate') }]}
          onChange={(chosen) => { if (chosen[0] !== undefined) field.onChange(chosen[0]); }} />
      )} />
      {when === 'date' ? (
        <Input {...date} type="date" label={t('console.settings.date')} error={form.formState.errors.date ? t('console.settings.invalidDate') : undefined} />
      ) : null}
    </Stack>
  );
}

interface ValueFormProps {
  venueId: string;
  setting: VenueSetting;
  /** What it is for: a table type's code, a tier's id, a stake or a role; empty for the venue. */
  subject: string;
  inForce: SettingValue | null;
  tiers: readonly { readonly subject: string; readonly label: string }[];
}

/**
 * A new value for one setting and subject, its fields built from the key's schema and filled with the
 * value in force; when it takes effect, and why. The database checks the value against the schema too.
 */
export function ValueForm({ venueId, setting, subject, inForce, tiers }: ValueFormProps) {
  const { schedule } = useSettingActions(venueId);
  const [outcome, setOutcome] = useState<SettingFailure | 'saved' | null>(null);
  const [resolver] = useState(() => resolverFor(setting));
  const form = useForm<ValueFormValues, unknown, ValueFormOutput>({
    resolver, defaultValues: { drafts: draftsFrom(setting.fields, inForce), when: 'now', date: '', reason: '' },
  });
  const submit = form.handleSubmit(async (change) => {
    const done = await schedule.mutateAsync({ key: setting.key, subject, ...change });
    setOutcome(done.ok ? 'saved' : done.error);
    if (done.ok) form.setValue('reason', '');
  });
  const reason = form.register('reason', { onChange: () => setOutcome(null) });
  return (
    <Stack gap={4}>
      <Heading level={3}>{t('console.settings.newValue')}</Heading>
      <SettingFields form={form} setting={setting} tiers={tiers} onEdit={() => setOutcome(null)} />
      <WhenField form={form} />
      <Input {...reason} label={t('console.settings.reason')} error={form.formState.errors.reason ? t('console.settings.invalidReason') : undefined} />
      <Inline gap={4}>
        <Button variant="primary" isLoading={schedule.isPending} onClick={() => void submit()}>{t('console.settings.schedule')}</Button>
        <StatusMessage>{outcome === 'saved' ? t('console.settings.saved') : null}</StatusMessage>
      </Inline>
      {outcome !== null && outcome !== 'saved' ? <ErrorMessage>{settingFailureText(outcome)}</ErrorMessage> : null}
    </Stack>
  );
}

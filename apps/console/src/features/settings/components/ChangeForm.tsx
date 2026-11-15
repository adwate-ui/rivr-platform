import { clockTimeSchema } from '@rivr/contracts/staff';
import { istMoment } from '@rivr/contracts/tournaments';
import type { Result } from '@rivr/contracts/result';
import { useSettingActions, type SettingChange, type SettingFailure, type SettingValue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Heading, Inline, Input, Stack, StatusMessage } from '@rivr/ui';
import { useState, type ReactNode } from 'react';
import { Controller, useForm, useWatch, type FieldErrors, type Resolver, type UseFormReturn } from 'react-hook-form';
import { settingFailureText } from './settingsCopy.ts';
import type { FieldDraft } from './valueDraft.ts';

type When = 'now' | 'date';

/** The form as typed: each field's draft, when it takes effect, and why. */
export interface ChangeFormValues {
  drafts: Record<string, FieldDraft>;
  when: When;
  date: string;
  time: string;
  reason: string;
}

/** One value to save: what it is for (empty for the venue), and the value. */
export interface ValueChange {
  readonly subject: string;
  readonly value: SettingValue;
}

/**
 * What the drafts read as: the values to save, or the fields that are wrong, or that they do not fit together, or that
 * nothing differs from what is in force.
 */
export type DraftsRead = { changes: readonly ValueChange[] } | { invalid: readonly string[] } | { notTogether: true } | { unchanged: true };

/** The form as saved: the values, from now (null) or a moment, and why. */
interface ChangeFormOutput {
  changes: readonly ValueChange[];
  effectiveFrom: string | null;
  reason: string;
}

export type ChangeFormApi = UseFormReturn<ChangeFormValues, unknown, ChangeFormOutput>;

/** From now (null), or from an IST day and 24-hour time still to come; undefined when what is typed is not one. */
export function startFrom(when: When, date: string, time: string, now: Date): string | null | undefined {
  if (when === 'now') return null;
  const clock = clockTimeSchema.safeParse(time);
  if (date === '' || !clock.success) return undefined;
  const moment = istMoment(date, clock.data);
  // The past is refused here as the database refuses it: a change never goes backwards.
  return Number.isNaN(moment.getTime()) || moment.getTime() <= now.getTime() ? undefined : moment.toISOString();
}

/**
 * The shortest reason the database takes for a control setting (private.guard_control_settings); every setting asks the
 * same, and the field says so before anything is sent.
 */
const REASON_MIN = 3;

/** The form's check: the values as their reader gives them, a day and time to come, and a reason of 3 to 200 characters. */
function resolverFor(read: ChangeFormProps['read']): Resolver<ChangeFormValues, unknown, ChangeFormOutput> {
  return (values) => {
    const drafts = read(values.drafts);
    const effectiveFrom = startFrom(values.when, values.date, values.time, new Date());
    const reason = values.reason.trim();
    const errors: FieldErrors<ChangeFormValues> = {};
    if ('invalid' in drafts) errors.drafts = Object.fromEntries(drafts.invalid.map((name) => [name, { type: 'value', message: '' }]));
    if ('notTogether' in drafts) errors.root = { together: { type: 'together', message: '' } };
    if ('unchanged' in drafts) errors.root = { unchanged: { type: 'unchanged', message: '' } };
    if (effectiveFrom === undefined) errors.date = { type: 'date', message: '' };
    if (reason.length < REASON_MIN || reason.length > 200) errors.reason = { type: 'reason', message: '' };
    if (!('changes' in drafts) || effectiveFrom === undefined || errors.reason) return { values: {}, errors };
    return { values: { changes: drafts.changes, effectiveFrom, reason }, errors: {} };
  };
}

/** When the change takes effect: now, or from a day and time to come, typed as Notices types them. */
function WhenField({ form }: { form: ChangeFormApi }) {
  const when = useWatch({ control: form.control, name: 'when' });
  const fields = { date: form.register('date'), time: form.register('time') };
  return (
    <Stack gap={3}>
      <Controller control={form.control} name="when" render={({ field }) => (
        <ChoiceChips label={t('console.settings.when')} mode="one" selected={[field.value]}
          options={[{ value: 'now', label: t('console.settings.now') }, { value: 'date', label: t('console.settings.fromDate') }]}
          onChange={(chosen) => { if (chosen[0] !== undefined) field.onChange(chosen[0]); }} />
      )} />
      {when === 'date' ? (
        <Inline gap={4} align="start" wrap>
          <Input {...fields.date} type="date" label={t('console.settings.date')}
            error={form.formState.errors.date === undefined ? undefined : t('console.settings.invalidDate')} />
          <Input {...fields.time} label={t('console.settings.time')} hint={t('console.settings.timeHint')} inputMode="numeric" autoComplete="off" />
        </Inline>
      ) : null}
    </Stack>
  );
}

/** Saves each value in turn, stopping at the first the database refuses. */
async function saveEach(changes: readonly SettingChange[], save: (change: SettingChange) => Promise<Result<null, SettingFailure>>): Promise<SettingFailure | null> {
  const [first, ...rest] = changes;
  if (first === undefined) return null;
  const done = await save(first);
  return done.ok ? saveEach(rest, save) : done.error;
}

interface ChangeFormProps {
  venueId: string;
  settingKey: string;
  /** The drafts the form starts from: the values in force. */
  drafts: Record<string, FieldDraft>;
  /** The drafts as the values to save, or what is wrong with them. */
  read: (drafts: Readonly<Record<string, FieldDraft>>) => DraftsRead;
  /** The value's own fields; `onEdit` clears what the last save said. */
  children: (form: ChangeFormApi, onEdit: () => void) => ReactNode;
}

/**
 * A setting's change (redesign RD-18): the new value's fields, when it takes effect (now, or a day and time to come,
 * never backwards) and why, then Save. The database checks the value and the moment too, and what it refuses is said.
 */
export function ChangeForm({ venueId, settingKey, drafts, read, children }: ChangeFormProps) {
  const { schedule } = useSettingActions(venueId);
  const [outcome, setOutcome] = useState<SettingFailure | 'saved' | null>(null);
  // The reader as it is now, each time: what is in force changes under an open form once a change is saved.
  const form = useForm<ChangeFormValues, unknown, ChangeFormOutput>({ resolver: resolverFor(read), defaultValues: { drafts, when: 'now', date: '', time: '', reason: '' } });
  const submit = form.handleSubmit(async ({ changes, effectiveFrom, reason }) => {
    const refused = await saveEach(changes.map((change) => ({ key: settingKey, ...change, effectiveFrom, reason })), (change) => schedule.mutateAsync(change));
    setOutcome(refused ?? 'saved');
    if (refused === null) form.setValue('reason', '');
  });
  const { errors } = form.formState;
  const reason = form.register('reason', { onChange: () => setOutcome(null) });
  const onEdit = () => {
    setOutcome(null);
    form.clearErrors('root');
  };
  return (
    <Stack gap={4}>
      <Heading level={3}>{t('console.settings.newValue')}</Heading>
      {children(form, onEdit)}
      {errors.root?.['together'] ? <ErrorMessage>{t('console.settings.notTogether')}</ErrorMessage> : null}
      {errors.root?.['unchanged'] ? <ErrorMessage>{t('console.settings.unchanged')}</ErrorMessage> : null}
      <WhenField form={form} />
      <Input {...reason} label={t('console.settings.reason')} maxLength={200}
        error={errors.reason === undefined ? undefined : t('console.settings.invalidReason')} />
      <Inline gap={4}>
        <Button variant="primary" isLoading={schedule.isPending} onClick={() => void submit()}>{t('console.settings.schedule')}</Button>
      </Inline>
      <StatusMessage>{outcome === 'saved' ? t('console.settings.saved') : null}</StatusMessage>
      {outcome !== null && outcome !== 'saved' ? <ErrorMessage>{settingFailureText(outcome)}</ErrorMessage> : null}
    </Stack>
  );
}

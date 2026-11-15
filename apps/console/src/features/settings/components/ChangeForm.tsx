import type { Result } from '@rivr/contracts/result';
import { clockTimeSchema } from '@rivr/contracts/staff';
import { istMoment } from '@rivr/contracts/tournaments';
import { useSettingActions, type SettingChange, type SettingEntry, type SettingFailure, type SettingValue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Heading, Inline, Input, Stack, StatusMessage } from '@rivr/ui';
import { useRef, useState, type ReactNode } from 'react';
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

/** A form with nothing typed yet but the drafts it starts from: from now, with no reason. */
export const startOf = (drafts: Record<string, FieldDraft>): ChangeFormValues => ({ drafts, when: 'now', date: '', time: '', reason: '' });

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
function resolverFor(read: ChangeFormOptions['read']): Resolver<ChangeFormValues, unknown, ChangeFormOutput> {
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

/** Saves each value in turn, stopping at the first the database refuses. */
async function saveEach(changes: readonly SettingChange[], save: (change: SettingChange) => Promise<Result<null, SettingFailure>>): Promise<SettingFailure | null> {
  const [first, ...rest] = changes;
  if (first === undefined) return null;
  const done = await save(first);
  return done.ok ? saveEach(rest, save) : done.error;
}

/**
 * Whether the value is already among the changes to come for that moment. A save of several values is not one step: when
 * a later one is refused, Save again sends only those not yet saved, or the first would be refused as taken.
 */
function isToCome(scheduled: readonly SettingEntry[], value: SettingValue, effectiveFrom: string | null): boolean {
  if (effectiveFrom === null) return false;
  const at = Date.parse(effectiveFrom);
  return scheduled.some((entry) => entry.effectiveFrom !== null && Date.parse(entry.effectiveFrom) === at && JSON.stringify(entry.value) === JSON.stringify(value));
}

interface ChangeFormOptions {
  venueId: string;
  settingKey: string;
  /** The drafts the form starts from: the values in force. */
  drafts: Record<string, FieldDraft>;
  /** The drafts as the values to save, or what is wrong with them. */
  read: (drafts: Readonly<Record<string, FieldDraft>>) => DraftsRead;
  /** A subject's changes to come, as the settings read them now. */
  toCome: (subject: string) => readonly SettingEntry[];
  onCancel: () => void;
}

/**
 * A setting's change (redesign RD-18), held by the panel that shows it: the new value's drafts, when it takes effect (now,
 * or a day and time to come, never backwards) and why. Save sends once however often it is pressed; the database checks
 * the value and the moment too, and what it refuses is said beside what it concerns. `ChangeFields` draws the form in the
 * panel's body and `ChangeFooter` its Cancel and Save in the panel's foot.
 */
export function useChangeForm({ venueId, settingKey, drafts, read, toCome, onCancel }: ChangeFormOptions) {
  const { schedule } = useSettingActions(venueId);
  const [outcome, setOutcome] = useState<SettingFailure | 'saved' | null>(null);
  const sending = useRef(false);
  // The reader as it is now, each time: what is in force changes under an open form once a change is saved.
  const form = useForm<ChangeFormValues, unknown, ChangeFormOutput>({ resolver: resolverFor(read), defaultValues: startOf(drafts) });
  const onEdit = () => {
    setOutcome(null);
    form.clearErrors('root');
  };
  const submit = form.handleSubmit(async ({ changes, effectiveFrom, reason }) => {
    const unsaved = changes.filter((change) => !isToCome(toCome(change.subject), change.value, effectiveFrom));
    const refused = await saveEach(unsaved.map((change) => ({ key: settingKey, ...change, effectiveFrom, reason })), (change) => schedule.mutateAsync(change));
    setOutcome(refused ?? 'saved');
    if (refused === null) form.setValue('reason', '');
  });
  const save = async () => {
    if (sending.current) return;
    sending.current = true;
    try {
      await submit();
    } finally {
      sending.current = false;
    }
  };
  return { form, onEdit, outcome, isSaving: schedule.isPending, save, onCancel };
}

export type ChangeFormState = ReturnType<typeof useChangeForm>;

/** What the database refused about the value itself, and about the moment: said beside those fields, the rest under the form. */
const VALUE_FAILURES: readonly SettingFailure[] = ['invalid'];
const WHEN_FAILURES: readonly SettingFailure[] = ['taken', 'too_soon'];

/** A refusal from the database, where it belongs; nothing for another place's. */
function Refusal({ outcome, place }: { outcome: ChangeFormState['outcome']; place: 'value' | 'when' | 'form' }) {
  if (outcome === null || outcome === 'saved') return null;
  const belongs = VALUE_FAILURES.includes(outcome) ? 'value' : WHEN_FAILURES.includes(outcome) ? 'when' : 'form';
  return belongs === place ? <ErrorMessage>{settingFailureText(outcome)}</ErrorMessage> : null;
}

/** When the change takes effect: now, or from a day and time to come, typed as Notices type them. */
function WhenField({ change }: { change: ChangeFormState }) {
  const { form, onEdit } = change;
  const when = useWatch({ control: form.control, name: 'when' });
  const fields = { date: form.register('date', { onChange: onEdit }), time: form.register('time', { onChange: onEdit }) };
  return (
    <Stack gap={3}>
      <Controller control={form.control} name="when" render={({ field }) => (
        <ChoiceChips label={t('console.settings.when')} mode="one" selected={[field.value]}
          options={[{ value: 'now', label: t('console.settings.now') }, { value: 'date', label: t('console.settings.fromDate') }]}
          onChange={(chosen) => {
            if (chosen[0] === undefined) return;
            onEdit();
            field.onChange(chosen[0]);
          }} />
      )} />
      {when === 'date' ? (
        <Inline gap={4} align="start" wrap>
          <Input {...fields.date} type="date" label={t('console.settings.date')}
            error={form.formState.errors.date === undefined ? undefined : t('console.settings.invalidDate')} />
          <Input {...fields.time} label={t('console.settings.time')} hint={t('console.settings.timeHint')} inputMode="numeric" autoComplete="off" />
        </Inline>
      ) : null}
      <Refusal outcome={change.outcome} place="when" />
    </Stack>
  );
}

/** The form in the panel's body: the new value's own fields (`children`), when, and why; then what the save did. */
export function ChangeFields({ change, children }: { change: ChangeFormState; children: ReactNode }) {
  const { form, onEdit, outcome } = change;
  const { errors } = form.formState;
  const reason = form.register('reason', { onChange: onEdit });
  return (
    <Stack gap={4}>
      <Heading level={3}>{t('console.settings.newValue')}</Heading>
      {children}
      {errors.root?.['together'] ? <ErrorMessage>{t('console.settings.notTogether')}</ErrorMessage> : null}
      {errors.root?.['unchanged'] ? <ErrorMessage>{t('console.settings.unchanged')}</ErrorMessage> : null}
      <Refusal outcome={outcome} place="value" />
      <WhenField change={change} />
      <Input {...reason} label={t('console.settings.reason')} maxLength={200}
        error={errors.reason === undefined ? undefined : t('console.settings.invalidReason')} />
      <StatusMessage>{outcome === 'saved' ? t('console.settings.saved') : null}</StatusMessage>
      <Refusal outcome={outcome} place="form" />
    </Stack>
  );
}

/** The panel's foot: Cancel, then Save, the panel's one gold button, busy while it saves. */
export function ChangeFooter({ change }: { change: ChangeFormState }) {
  return (
    <Inline gap={2} justify="end">
      <Button variant="text" size="compact" onClick={change.onCancel}>{t('common.cancel')}</Button>
      <Button variant="primary" size="compact" isLoading={change.isSaving} onClick={() => void change.save()}>{t('console.settings.schedule')}</Button>
    </Inline>
  );
}

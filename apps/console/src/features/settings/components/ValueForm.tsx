import { useSettingActions, type SettingFailure, type SettingValue, type VenueSetting } from '@rivr/db';
import { isLaterIstDay, istMidnight, t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Grid, Heading, Inline, Input, Stack, StatusMessage } from '@rivr/ui';
import { useId, useState, type ReactNode } from 'react';
import { Controller, useForm, useWatch, type FieldErrors, type Resolver, type UseFormReturn } from 'react-hook-form';
import { FieldInput } from './FieldInput.tsx';
import { settingFailureText } from './settingsCopy.ts';
import { draftsFrom, readValue, type FieldDraft } from './valueDraft.ts';

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


/** From now (null), or from midnight IST on a later day; undefined when the day is not a later one. */
function startFrom(when: When, date: string): string | null | undefined {
  if (when === 'now') return null;
  // A later day only: today's midnight has passed, and the database refuses the past.
  return isLaterIstDay(date) ? istMidnight(date) : undefined;
}

/**
 * The shortest reason the database takes for a control setting (private.guard_control_settings); every setting asks the
 * same, and the field says so before anything is sent.
 */
export const REASON_MIN = 3;

/** The form's check: the value by its key's schema (readValue), a later day, and a reason of 3 to 200 characters. */
function resolverFor(setting: VenueSetting): Resolver<ValueFormValues, unknown, ValueFormOutput> {
  return (values) => {
    const read = readValue(setting.key, setting.fields, values.drafts);
    const effectiveFrom = startFrom(values.when, values.date);
    const reason = values.reason.trim();
    const errors: FieldErrors<ValueFormValues> = {};
    if ('invalid' in read) errors.drafts = Object.fromEntries(read.invalid.map((name) => [name, { type: 'value', message: '' }]));
    if ('notTogether' in read) errors.root = { together: { type: 'together', message: '' } };
    if (effectiveFrom === undefined) errors.date = { type: 'date', message: '' };
    if (reason.length < REASON_MIN || reason.length > 200) errors.reason = { type: 'reason', message: '' };
    if (!('value' in read) || effectiveFrom === undefined || errors.reason) return { values: {}, errors };
    return { values: { value: read.value, effectiveFrom, reason }, errors: {} };
  };
}

const draftPath = (name: string) => `drafts.${name}` as const;

type Form = UseFormReturn<ValueFormValues, unknown, ValueFormOutput>;

/** Each field of the value, as its schema gives it. */
function SettingFields({ form, setting, tiers, onEdit }: { form: Form; setting: VenueSetting; tiers: ValueFormProps['tiers']; onEdit: () => void }) {
  const invalid = form.formState.errors.drafts ?? {};
  return (
    <Grid columns={2} gap={4} stackBelow="medium">
      {setting.fields.map((field) => (
        <Controller key={field.name} control={form.control} name={draftPath(field.name)} render={({ field: draft }) => (
          <FieldInput settingKey={setting.key} field={field} draft={draft.value} isInvalid={invalid[field.name] !== undefined} tiers={tiers}
            onChange={(next) => { onEdit(); draft.onChange(next); }} />
        )} />
      ))}
    </Grid>
  );
}

/** Where a row's errors go: under the row, by id, so the row's controls stay on one line (console v3). */
interface RowNotes {
  readonly date: string;
  readonly reason: string;
}

/** A field's error, in the panel, under the field; in a row, under the row and pointed at, so the row stays one line. */
function errorProps(isWrong: boolean, text: string, noteId: string | undefined) {
  if (noteId === undefined) return { error: isWrong ? text : undefined };
  return { 'aria-describedby': isWrong ? noteId : undefined, 'aria-invalid': isWrong || undefined };
}

/** When the change takes effect: now, or from a later day; in a row, the day beside the choice. */
function WhenField({ form, noteId }: { form: Form; noteId?: string | undefined }) {
  const when = useWatch({ control: form.control, name: 'when' });
  const date = form.register('date');
  const isRow = noteId !== undefined;
  const Layout = isRow ? WhenRow : WhenStack;
  // In a row the chips' choices say what they are, so their name is read out only.
  const chipLook = isRow ? { look: 'subtle', isLabelVisuallyHidden: true } as const : {};
  return (
    <Layout>
      <Controller control={form.control} name="when" render={({ field }) => (
        <ChoiceChips label={t('console.settings.when')} mode="one" selected={[field.value]} {...chipLook}
          options={[{ value: 'now', label: t('console.settings.now') }, { value: 'date', label: t('console.settings.fromDate') }]}
          onChange={(chosen) => { if (chosen[0] !== undefined) field.onChange(chosen[0]); }} />
      )} />
      {when === 'date' ? (
        <Input {...date} type="date" variant={isRow ? 'subtle' : 'boxed'} label={t('console.settings.date')}
          {...errorProps(form.formState.errors.date !== undefined, t('console.settings.invalidDate'), noteId)} />
      ) : null}
    </Layout>
  );
}

const WhenStack = ({ children }: { children: ReactNode }) => <Stack gap={3}>{children}</Stack>;
const WhenRow = ({ children }: { children: ReactNode }) => <Inline gap={3} align="end" wrap>{children}</Inline>;

interface ValueFormProps {
  venueId: string;
  /**
   * `panel`, under its heading in the setting's panel; `row`, opened in the setting's row of the list (console v3): its
   * fields, then when, why and Save on one line.
   */
  look?: 'panel' | 'row';
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
export function ValueForm({ venueId, setting, subject, inForce, tiers, look = 'panel' }: ValueFormProps) {
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
  const notes = { date: useId(), reason: useId() };
  const rowNotes = look === 'row' ? notes : undefined;
  const reasonField = (
    <Input {...reason} variant={look === 'row' ? 'subtle' : 'boxed'} label={t('console.settings.reason')} maxLength={200}
      {...errorProps(form.formState.errors.reason !== undefined, t('console.settings.invalidReason'), rowNotes?.reason)} />
  );
  const save = (
    <Button variant="primary" size={look === 'row' ? 'compact' : 'regular'} isLoading={schedule.isPending} onClick={() => void submit()}>
      {t('console.settings.schedule')}
    </Button>
  );
  return (
    <Stack gap={4}>
      {look === 'panel' ? <Heading level={3}>{t('console.settings.newValue')}</Heading> : null}
      <SettingFields form={form} setting={setting} tiers={tiers} onEdit={() => setOutcome(null)} />
      {form.formState.errors.root?.['together'] ? <ErrorMessage>{t('console.settings.notTogether')}</ErrorMessage> : null}
      <WhenWhySave notes={rowNotes} form={form} reason={reasonField} save={save} />
      {rowNotes === undefined ? null : <RowErrors form={form} notes={rowNotes} />}
      <OutcomeLines outcome={outcome} />
    </Stack>
  );
}

/** When, why and Save: in a row on one line, the console's subtle controls of one height, level at their foot (console v3). */
function WhenWhySave({ notes, form, reason, save }: { notes: RowNotes | undefined; form: Form; reason: ReactNode; save: ReactNode }) {
  if (notes !== undefined) {
    // When beside why and Save from 768 px; on a phone each pair on its own line, so the reason keeps its width.
    return <Grid columns={2} gap={3} stackBelow="medium"><WhenField form={form} noteId={notes.date} /><Inline gap={3} align="end">{reason}{save}</Inline></Grid>;
  }
  return <><WhenField form={form} />{reason}<Inline gap={4}>{save}</Inline></>;
}

/** Under a row: a day that is not a later one, and a reason too short, each said before anything is sent. */
function RowErrors({ form, notes }: { form: Form; notes: RowNotes }) {
  const { errors } = form.formState;
  return (
    <>
      {errors.date ? <ErrorMessage id={notes.date}>{t('console.settings.invalidDate')}</ErrorMessage> : null}
      {errors.reason ? <ErrorMessage id={notes.reason}>{t('console.settings.invalidReason')}</ErrorMessage> : null}
    </>
  );
}

/** Under the form: what the save did. */
function OutcomeLines({ outcome }: { outcome: SettingFailure | 'saved' | null }) {
  return (
    <>
      <StatusMessage>{outcome === 'saved' ? t('console.settings.saved') : null}</StatusMessage>
      {outcome !== null && outcome !== 'saved' ? <ErrorMessage>{settingFailureText(outcome)}</ErrorMessage> : null}
    </>
  );
}


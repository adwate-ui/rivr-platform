import type { SettingField } from '@rivr/db';
import { t } from '@rivr/i18n';
import { ChoiceChips, EditableList, ErrorMessage, Input, Stack, Switch, Text } from '@rivr/ui';
import { fieldHint, fieldLabel, limitsText, optionLabel, unitOf } from './settingsCopy.ts';
import type { FieldDraft } from './valueDraft.ts';

interface FieldInputProps {
  /** The setting the field belongs to, for its words. */
  settingKey: string;
  field: SettingField;
  draft: FieldDraft;
  isInvalid: boolean;
  tiers: readonly { readonly subject: string; readonly label: string }[];
  onChange: (draft: FieldDraft) => void;
}

/** One of the schema's words, one of the venue's tiers, or any number of the schema's words (a list). */
function ChoiceField({ settingKey, field, draft, isInvalid, tiers, onChange }: FieldInputProps & { field: Extract<SettingField, { kind: 'choice' | 'tier' | 'choices' }> }) {
  const options = field.kind === 'tier'
    ? tiers.map((tier) => ({ value: tier.subject, label: tier.label }))
    : field.options.map((option) => ({ value: option, label: optionLabel(settingKey, option) }));
  const one = typeof draft === 'string' && draft !== '' ? [draft] : [];
  const selected = typeof draft === 'object' && draft !== null ? draft.map(String) : one;
  return (
    <Stack gap={2}>
      <ChoiceChips label={fieldLabel(settingKey, field.name)} mode={field.kind === 'choices' ? 'many' : 'one'} selected={selected} options={options}
        onChange={(chosen) => onChange(field.kind === 'choices' ? chosen : chosen[0] ?? '')} />
      {isInvalid ? <ErrorMessage>{t('console.settings.noChoice')}</ErrorMessage> : null}
    </Stack>
  );
}

/** The units a typed list can be in: the ones its editor writes after each entry. */
const LIST_UNITS = ['minutes', 'hours', 'days', 'seconds'] as const;

/**
 * A list the club types (redesign RD-19): add, edit and remove, each entry within the schema's limits. The list says under
 * an entry why it is refused, and beside Add once it holds its most; too few is said here once Save finds it. A list in a unit its
 * editor does not write has no editor: no setting declares one.
 */
function ListField({ settingKey, field, draft, isInvalid, onChange }: FieldInputProps & { field: Extract<SettingField, { kind: 'numbers' }> }) {
  const unit = LIST_UNITS.find((one) => one === unitOf(field));
  if (unit === undefined) return null;
  // A list's own words under it: Extend call time's "beyond the current end" (#1089).
  const hint = fieldHint(settingKey, field.name);
  return (
    <Stack gap={2}>
      <EditableList label={fieldLabel(settingKey, field.name)} entryLabel={t('console.settings.listEntry')} addLabel={t('console.settings.listAdd')} unit={unit}
        min={field.min} max={field.max} maxEntries={field.most ?? undefined} initialValues={typeof draft === 'object' && draft !== null ? [...draft].map(Number) : []} onChange={onChange} />
      {hint === undefined ? null : <Text variant="caption" tone="muted">{hint}</Text>}
      {isInvalid && draft !== null ? <ErrorMessage>{t('console.settings.invalidList')}</ErrorMessage> : null}
    </Stack>
  );
}

/** The words after a number: a percent or a time; none for money, which has the ₹ before it, or a count. */
function suffixOf(field: Extract<SettingField, { kind: 'integer' }>): string | undefined {
  const unit = unitOf(field);
  return unit === null ? undefined : t(`console.settings.suffixes.${unit}`);
}

/** A number in its unit: ₹ before money, % or a time after the value, its limits as the hint and, when wrong, the error. */
function NumberField({ settingKey, field, draft, isInvalid, onChange }: FieldInputProps & { field: Extract<SettingField, { kind: 'integer' }> }) {
  const limits = limitsText(field);
  // The limits, then what a value means where they do not say, then whether it may be left empty.
  const hint = [limits, fieldHint(settingKey, field.name), field.isRequired ? undefined : t('console.settings.optional')].filter((part) => part !== undefined && part !== '').join(' ');
  return (
    <Input label={fieldLabel(settingKey, field.name)} hint={isInvalid ? undefined : hint} error={isInvalid ? limits : undefined}
      value={typeof draft === 'string' ? draft : ''} inputMode="decimal" prefix={field.isMoney ? t('console.settings.rupee') : undefined}
      suffix={suffixOf(field)} onChange={(event) => onChange(event.target.value)} />
  );
}

/** Why text was refused: nothing given, or not in the form its setting takes (a section, a review link). */
function textError(draft: FieldDraft, isInvalid: boolean): string | undefined {
  if (!isInvalid) return undefined;
  return typeof draft === 'string' && draft.trim() !== '' ? t('console.settings.invalidText') : t('console.settings.required');
}

/** A switch, with what on and off mean under it where the setting says. */
function SwitchField({ settingKey, field, draft, onChange }: FieldInputProps) {
  const hint = fieldHint(settingKey, field.name);
  return <Switch label={fieldLabel(settingKey, field.name)} {...(hint === undefined ? {} : { hint })} isOn={draft === true} onChange={onChange} />;
}

/** One field of a setting's value, as its schema gives it: a number, a switch, a choice, a list, a tier or text. */
export function FieldInput(props: FieldInputProps) {
  const { settingKey, field, draft, isInvalid, onChange } = props;
  if (field.kind === 'boolean') return <SwitchField {...props} />;
  if (field.kind === 'choice' || field.kind === 'tier' || field.kind === 'choices') return <ChoiceField {...props} field={field} />;
  if (field.kind === 'integer') return <NumberField {...props} field={field} />;
  if (field.kind === 'numbers') return <ListField {...props} field={field} />;
  return (
    <Input label={fieldLabel(settingKey, field.name)} hint={field.isRequired ? undefined : t('console.settings.optional')}
      error={textError(draft, isInvalid)} value={typeof draft === 'string' ? draft : ''}
      type={field.name === 'url' ? 'url' : 'text'} onChange={(event) => onChange(event.target.value)} />
  );
}

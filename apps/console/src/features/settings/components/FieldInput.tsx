import type { SettingField } from '@rivr/db';
import { t } from '@rivr/i18n';
import { ChoiceChips, ErrorMessage, Input, Stack, Switch } from '@rivr/ui';
import { fieldLabel, isBasisPoints } from './settingsCopy.ts';

/** What a field holds while it is typed: text for numbers, words and tiers; a switch's state. */
export type FieldDraft = string | boolean;

interface FieldInputProps {
  field: SettingField;
  draft: FieldDraft;
  isInvalid: boolean;
  tiers: readonly { readonly subject: string; readonly label: string }[];
  onChange: (draft: FieldDraft) => void;
}

/** A number's hint: rupees or basis points, and its limits. */
function integerHint(field: Extract<SettingField, { kind: 'integer' }>): string {
  // Limits in paise would read wrongly as rupees, so a money field's are left to its error.
  if (field.isMoney) return t('console.settings.inRupees');
  const unit = isBasisPoints(field.name) ? [t('console.settings.inBasisPoints')] : [];
  const limits = field.min !== null && field.max !== null ? [t('console.settings.range', { min: field.min, max: field.max })] : [];
  return [...unit, ...limits].join(' ');
}

/** A field with a fixed set of answers: one of the schema's words, or one of the venue's tiers. */
function ChoiceField({ field, draft, isInvalid, tiers, onChange }: FieldInputProps & { field: Extract<SettingField, { kind: 'choice' | 'tier' }> }) {
  const options = field.kind === 'tier'
    ? tiers.map((tier) => ({ value: tier.subject, label: tier.label }))
    : field.options.map((option) => ({ value: option, label: fieldLabel(option) }));
  return (
    <Stack gap={2}>
      <ChoiceChips label={fieldLabel(field.name)} mode="one" selected={typeof draft === 'string' && draft !== '' ? [draft] : []} options={options}
        onChange={(chosen) => onChange(chosen[0] ?? '')} />
      {isInvalid ? <ErrorMessage>{t('console.settings.invalidField')}</ErrorMessage> : null}
    </Stack>
  );
}

/** One field of a setting's value, as its schema gives it: a number, a switch, a choice, a tier or text. */
export function FieldInput({ field, draft, isInvalid, tiers, onChange }: FieldInputProps) {
  const label = fieldLabel(field.name);
  const error = isInvalid ? t('console.settings.invalidField') : undefined;
  if (field.kind === 'boolean') return <Switch label={label} isOn={draft === true} onChange={onChange} />;
  if (field.kind === 'choice' || field.kind === 'tier') return <ChoiceField field={field} draft={draft} isInvalid={isInvalid} tiers={tiers} onChange={onChange} />;
  const text = typeof draft === 'string' ? draft : '';
  const hint = field.kind === 'integer' ? integerHint(field) : undefined;
  return <Input label={label} hint={hint} error={error} value={text} inputMode={field.kind === 'integer' ? 'decimal' : 'text'} onChange={(event) => onChange(event.target.value)} />;
}

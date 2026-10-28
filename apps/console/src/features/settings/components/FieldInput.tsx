import type { SettingField } from '@rivr/db';
import { t } from '@rivr/i18n';
import { ChoiceChips, ErrorMessage, Input, Stack, Switch } from '@rivr/ui';
import { fieldLabel, limitsText, optionLabel, unitOf } from './settingsCopy.ts';
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
  const selected = typeof draft === 'object' ? [...draft] : one;
  return (
    <Stack gap={2}>
      <ChoiceChips label={fieldLabel(settingKey, field.name)} mode={field.kind === 'choices' ? 'many' : 'one'} selected={selected} options={options}
        onChange={(chosen) => onChange(field.kind === 'choices' ? chosen : chosen[0] ?? '')} />
      {isInvalid ? <ErrorMessage>{t('console.settings.noChoice')}</ErrorMessage> : null}
    </Stack>
  );
}

/** A number in its unit: ₹ before money, % or a time after the value, its limits as the hint and, when wrong, the error. */
function NumberField({ settingKey, field, draft, isInvalid, onChange }: FieldInputProps & { field: Extract<SettingField, { kind: 'integer' }> }) {
  const unit = unitOf(field);
  const limits = limitsText(field);
  const hint = field.isRequired ? limits : `${limits} ${t('console.settings.optional')}`.trim();
  return (
    <Input label={fieldLabel(settingKey, field.name)} hint={isInvalid ? undefined : hint} error={isInvalid ? limits : undefined}
      value={typeof draft === 'string' ? draft : ''} inputMode="decimal" prefix={field.isMoney ? t('console.settings.rupee') : undefined}
      suffix={unit === null ? undefined : t(`console.settings.suffixes.${unit}`)} onChange={(event) => onChange(event.target.value)} />
  );
}

/** Why text was refused: nothing given, or not in the form its setting takes (a section, a review link). */
function textError(draft: FieldDraft, isInvalid: boolean): string | undefined {
  if (!isInvalid) return undefined;
  return typeof draft === 'string' && draft.trim() !== '' ? t('console.settings.invalidText') : t('console.settings.required');
}

/** One field of a setting's value, as its schema gives it: a number, a switch, a choice, a list, a tier or text. */
export function FieldInput(props: FieldInputProps) {
  const { settingKey, field, draft, isInvalid, onChange } = props;
  if (field.kind === 'boolean') return <Switch label={fieldLabel(settingKey, field.name)} isOn={draft === true} onChange={onChange} />;
  if (field.kind === 'choice' || field.kind === 'tier' || field.kind === 'choices') return <ChoiceField {...props} field={field} />;
  if (field.kind === 'integer') return <NumberField {...props} field={field} />;
  return (
    <Input label={fieldLabel(settingKey, field.name)} hint={field.isRequired ? undefined : t('console.settings.optional')}
      error={textError(draft, isInvalid)} value={typeof draft === 'string' ? draft : ''}
      type={field.name === 'url' ? 'url' : 'text'} onChange={(event) => onChange(event.target.value)} />
  );
}

import { SETTINGS } from '@rivr/contracts/settings';
import type { SettingFailure, SettingField, SettingValue, VenueConfigFailure } from '@rivr/db';
import { fromPaise } from '@rivr/domain/money';
import { formatList, formatMoney, formatNumber, settingCopy, t } from '@rivr/i18n';

/** A field holding basis points (hundredths of a percent) is a percentage on screen: 500 is 5%. */
export const isBasisPoints = (name: string) => name === 'basis_points' || name.endsWith('_basis_points');

/** Whether a field holds paise, typed and shown in rupees. */
export const isMoney = (field: SettingField) => field.kind === 'integer' && field.isMoney;

/** The unit a number is typed and shown in (#604). */
export type Unit = 'percent' | 'minutes' | 'days' | 'seconds' | 'hours' | 'years';
const ENDINGS: readonly Exclude<Unit, 'percent'>[] = ['minutes', 'days', 'seconds', 'hours', 'years'];

/**
 * A number's unit, from its name: a rate in %, `window_minutes` in minutes; none for money (₹) or counts. A new unit
 * needs its ending here and its words in console.settings.units and console.settings.suffixes.
 */
export function unitOf(field: SettingField): Unit | null {
  if (field.kind !== 'integer' || field.isMoney) return null;
  if (isBasisPoints(field.name)) return 'percent';
  return ENDINGS.find((ending) => field.name === ending || field.name.endsWith(`_${ending}`)) ?? null;
}

/** Words from a schema name, for a key with none yet: `final_table` is "Final table". */
function fromWords(name: string): string {
  const words = name.replace(/_(paise|basis_points)$/, '').replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A setting's name as staff read it; its key, for one with no words yet. */
export const settingName = (key: string) => settingCopy(key)?.name ?? key;
/** What a setting does, in one line; the database's description, for one with no words yet. */
export const settingHelp = (key: string, description: string) => settingCopy(key)?.help ?? description;
export const fieldLabel = (key: string, name: string) => settingCopy(key)?.fields[name] ?? fromWords(name);
export const optionLabel = (key: string, option: string) => settingCopy(key)?.options?.[option] ?? fromWords(option);
/** Only a super admin changes it: the database's guard triggers (SettingDefinition.superAdminOnly). */
export const isSuperAdminOnly = (key: string) => SETTINGS.some((definition) => definition.key === key && 'superAdminOnly' in definition);

/** A number in its unit: ₹3,000, 5%, 30 minutes or a plain count. */
function numberText(field: SettingField, value: number): string {
  if (isMoney(field)) return formatMoney(fromPaise(BigInt(value)));
  const unit = unitOf(field);
  if (unit === 'percent') return t('console.settings.units.percent', { value: formatNumber(value / 100) });
  return unit === null ? formatNumber(value) : t(`console.settings.units.${unit}`, { value: formatNumber(value) });
}

/** One field's value: in its unit, a switch as on or off, a choice or a list in words, a tier by name. */
function fieldText(key: string, field: SettingField, value: SettingValue[string] | undefined, tierName: (id: string) => string): string {
  if (value === undefined) return t('console.settings.notSet');
  if (typeof value === 'boolean') return value ? t('console.settings.on') : t('console.settings.off');
  if (typeof value === 'number') return numberText(field, value);
  if (typeof value !== 'string') return value.length === 0 ? t('console.settings.noneChosen') : formatList(value.map((option) => optionLabel(key, option)));
  if (field.kind === 'tier') return tierName(value);
  return field.kind === 'choice' ? optionLabel(key, value) : value;
}

/** A value as one line: "30 minutes" for a single field, "Rate: 5% · Cap: ₹3,000" for more. */
export function valueText(key: string, fields: readonly SettingField[], value: SettingValue, tierName: (id: string) => string): string {
  const [only] = fields;
  if (fields.length === 1 && only !== undefined) return fieldText(key, only, value[only.name], tierName);
  return fields.map((field) => t('console.settings.fieldValue', { field: fieldLabel(key, field.name), value: fieldText(key, field, value[field.name], tierName) }))
    .join(t('console.settings.fieldSeparator'));
}

/** A number's limits in its unit, as its hint and its error: "Between 1 and 120 minutes.", "In whole ₹50 chips." */
export function limitsText(field: Extract<SettingField, { kind: 'integer' }>): string {
  const unit = unitOf(field);
  // A time names its unit once, after the upper limit ("Between 1 and 120 minutes"); a percent or money on both ends.
  const minText = (value: number) => (unit === null || unit === 'percent' ? numberText(field, value) : formatNumber(value));
  const parts: string[] = [];
  if (field.min !== null && field.max !== null) parts.push(t('console.settings.between', { min: minText(field.min), max: numberText(field, field.max) }));
  else if (field.min !== null) parts.push(t('console.settings.atLeast', { min: numberText(field, field.min) }));
  else if (field.max !== null) parts.push(t('console.settings.upTo', { max: numberText(field, field.max) }));
  if (field.isChips) parts.push(t('console.settings.inChips'));
  if (unit === 'percent') parts.push(t('console.settings.twoDecimals'));
  return parts.join(' ');
}

export function settingFailureText(failure: SettingFailure): string {
  return t(`console.settings.failures.${failure}`);
}

export function venueFailureText(failure: VenueConfigFailure): string {
  return t(`console.settings.venueFailures.${failure}`);
}

import type { SettingFailure, SettingField, SettingValue, VenueConfigFailure } from '@rivr/db';
import { fromPaise } from '@rivr/domain/money';
import { formatMoney, formatNumber, t } from '@rivr/i18n';

/** A field holding basis points says so; one holding money (`isMoney`) is typed in rupees. */
export const isBasisPoints = (name: string) => name.endsWith('_basis_points');

/** Whether a field holds paise, typed and shown in rupees. */
export const isMoney = (field: SettingField) => field.kind === 'integer' && field.isMoney;

/**
 * A field's name, or one of its choices, as the screen shows it, from the schema's own word, so a key any
 * lane adds needs no copy here: `cap_paise` is "Cap", `financial_year` "Financial year".
 */
export function fieldLabel(name: string): string {
  const words = name.replace(/_(paise|basis_points)$/, '').replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** One field's value as the screen shows it: money in rupees, a switch as on or off, a choice in words, a tier by name. */
function fieldText(field: SettingField, value: number | boolean | string | undefined, tierName: (id: string) => string): string {
  if (value === undefined) return t('console.settings.notSet');
  if (typeof value === 'boolean') return value ? t('console.settings.on') : t('console.settings.off');
  if (typeof value === 'number' && isMoney(field)) return formatMoney(fromPaise(BigInt(value)));
  // 500 basis points read as 5%.
  if (typeof value === 'number') return isBasisPoints(field.name) ? t('console.settings.percent', { value: formatNumber(value / 100) }) : formatNumber(value);
  if (field.kind === 'tier') return tierName(value);
  return field.kind === 'choice' ? fieldLabel(value) : value;
}

/** A value as one line: "Cap: ₹3,000 · Rate: 5%". */
export function valueText(fields: readonly SettingField[], value: SettingValue, tierName: (id: string) => string): string {
  return fields.map((field) => t('console.settings.fieldValue', { field: fieldLabel(field.name), value: fieldText(field, value[field.name], tierName) }))
    .join(t('console.settings.fieldSeparator'));
}

export function settingFailureText(failure: SettingFailure): string {
  return t(`console.settings.failures.${failure}`);
}

export function venueFailureText(failure: VenueConfigFailure): string {
  return t(`console.settings.venueFailures.${failure}`);
}

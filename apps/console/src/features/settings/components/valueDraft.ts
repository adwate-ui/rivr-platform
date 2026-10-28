import { SETTINGS } from '@rivr/contracts/settings';
import type { SettingField, SettingValue } from '@rivr/db';
import { parseRupees } from '@rivr/domain/money';
import { formatRupeesForInput } from '@rivr/i18n';
import { isMoney, unitOf } from './settingsCopy.ts';

/** What a field holds while it is typed: text for numbers, words and tiers; a switch's state; a list's choices. */
export type FieldDraft = string | boolean | readonly string[];

type FieldValue = SettingValue[string];

/** A field's draft from its stored value: money in rupees (after the ₹), a rate in percent, a list as chosen. */
function draftOf(field: SettingField, current: FieldValue | undefined): FieldDraft {
  if (field.kind === 'boolean') return current === true;
  if (field.kind === 'choices') return typeof current === 'object' ? current : [];
  if (typeof current !== 'number') return typeof current === 'string' ? current : '';
  if (isMoney(field)) return formatRupeesForInput(BigInt(current));
  // 525 basis points is typed as 5.25.
  return unitOf(field) === 'percent' ? String(current / 100) : String(current);
}

/** The drafts a form starts from: the value in force, or empty. */
export function draftsFrom(fields: readonly SettingField[], value: SettingValue | null): Record<string, FieldDraft> {
  return Object.fromEntries(fields.map((field) => [field.name, draftOf(field, value?.[field.name])]));
}

/** A number as typed in its unit: rupees for money, a percentage of up to two decimals for a rate, else a whole number. */
function typedNumber(field: Extract<SettingField, { kind: 'integer' }>, text: string): number | null {
  const typed = text.trim();
  if (field.isMoney) {
    const paise = parseRupees(typed);
    return paise.ok ? Number(paise.value) : null;
  }
  // Digits may be grouped, as the limits show them: 10,00,000.
  const digits = typed.replaceAll(',', '');
  if (unitOf(field) === 'percent') return /^\d+(\.\d{1,2})?$/.test(digits) ? Math.round(Number(digits) * 100) : null;
  return /^-?\d+$/.test(digits) ? Number(digits) : null;
}

/** A number within its limits, as stored (paise, basis points), or null. */
function readInteger(field: Extract<SettingField, { kind: 'integer' }>, text: string): number | null {
  const number = typedNumber(field, text);
  if (number === null || (field.min !== null && number < field.min) || (field.max !== null && number > field.max)) return null;
  return number;
}

/** One field's value from its draft: null when it is wrong; undefined for an optional field left empty. */
function readField(field: SettingField, draft: FieldDraft | undefined): FieldValue | null | undefined {
  if (field.kind === 'boolean') return draft === true;
  if (field.kind === 'choices') return typeof draft === 'object' ? draft.filter((option) => field.options.includes(option)) : [];
  if (typeof draft !== 'string' || draft.trim() === '') return field.isRequired ? null : undefined;
  return field.kind === 'integer' ? readInteger(field, draft) : draft.trim();
}

/** The value as typed, or the fields missing, not a number, or past their limits. */
export function valueFrom(fields: readonly SettingField[], drafts: Readonly<Record<string, FieldDraft>>): { value: SettingValue } | { invalid: readonly string[] } {
  const read = fields.map((field) => [field.name, readField(field, drafts[field.name])] as const);
  const invalid = read.filter(([, value]) => value === null).map(([name]) => name);
  if (invalid.length > 0) return { invalid };
  return { value: Object.fromEntries(read.filter((entry): entry is readonly [string, FieldValue] => entry[1] !== null && entry[1] !== undefined)) };
}

/**
 * The value to save, checked by its key's schema in @rivr/contracts when the key is declared there (whole ₹50 chips, a
 * section's pattern), or the fields that are wrong; for a rule across them (a split that adds up), that they do not fit
 * together. A key only the database knows is checked there, against the same schema.
 */
export function readValue(key: string, fields: readonly SettingField[], drafts: Readonly<Record<string, FieldDraft>>):
  { value: SettingValue } | { invalid: readonly string[] } | { notTogether: true } {
  const read = valueFrom(fields, drafts);
  if ('invalid' in read) return read;
  const checked = SETTINGS.find((definition) => definition.key === key)?.value.safeParse(read.value);
  if (checked === undefined || checked.success) return read;
  const named = checked.error.issues.map((issue) => String(issue.path[0] ?? ''));
  return named.includes('') ? { notTogether: true } : { invalid: named };
}

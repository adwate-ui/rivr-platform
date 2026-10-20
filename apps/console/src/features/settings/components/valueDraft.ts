import { SETTINGS } from '@rivr/contracts/settings';
import type { SettingField, SettingValue } from '@rivr/db';
import { fromPaise, parseRupees } from '@rivr/domain/money';
import { formatMoney } from '@rivr/i18n';
import type { FieldDraft } from './FieldInput.tsx';
import { isMoney } from './settingsCopy.ts';

/** The drafts a form starts from: the value in force, or empty. Money shows as it is written, ₹5,000. */
export function draftsFrom(fields: readonly SettingField[], value: SettingValue | null): Record<string, FieldDraft> {
  return Object.fromEntries(fields.map((field) => {
    const current = value?.[field.name];
    if (field.kind === 'boolean') return [field.name, current === true];
    if (typeof current === 'number') return [field.name, isMoney(field) ? formatMoney(fromPaise(BigInt(current))) : String(current)];
    return [field.name, typeof current === 'string' ? current : ''];
  }));
}

/** A number as typed: rupees for a money field (in paise, as stored), a whole number otherwise; null if neither. */
function readInteger(field: Extract<SettingField, { kind: 'integer' }>, text: string): number | null {
  let number: number | null = null;
  if (field.isMoney) {
    const paise = parseRupees(text);
    number = paise.ok ? Number(paise.value) : null;
  } else if (/^-?\d+$/.test(text.trim())) {
    number = Number(text.trim());
  }
  if (number === null || (field.min !== null && number < field.min) || (field.max !== null && number > field.max)) return null;
  return number;
}

/** One field's value from its draft, or null when it is missing or out of its limits. */
function readField(field: SettingField, draft: FieldDraft | undefined): number | boolean | string | null {
  if (field.kind === 'boolean') return draft === true;
  if (typeof draft !== 'string' || draft.trim() === '') return null;
  return field.kind === 'integer' ? readInteger(field, draft) : draft.trim();
}

/** The value as typed, or the fields missing, not a number, or past their limits. */
export function valueFrom(fields: readonly SettingField[], drafts: Readonly<Record<string, FieldDraft>>): { value: SettingValue } | { invalid: readonly string[] } {
  const read = fields.map((field) => [field.name, readField(field, drafts[field.name])] as const);
  const invalid = read.filter(([, value]) => value === null).map(([name]) => name);
  if (invalid.length > 0) return { invalid };
  return { value: Object.fromEntries(read.filter((entry): entry is readonly [string, number | boolean | string] => entry[1] !== null)) };
}

/**
 * The value to save, checked by its key's schema in @rivr/contracts when the key is declared there (whole
 * ₹50 chips, a section's pattern, a split that adds up), or the fields that are wrong: every field, for a
 * rule across them. A key only the database knows is checked there, against the same schema.
 */
export function readValue(key: string, fields: readonly SettingField[], drafts: Readonly<Record<string, FieldDraft>>) {
  const read = valueFrom(fields, drafts);
  if ('invalid' in read) return read;
  const checked = SETTINGS.find((definition) => definition.key === key)?.value.safeParse(read.value);
  if (checked === undefined || checked.success) return read;
  const named = checked.error.issues.map((issue) => String(issue.path[0] ?? ''));
  return { invalid: named.includes('') ? fields.map((field) => field.name) : named };
}

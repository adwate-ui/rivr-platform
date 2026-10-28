import type { Json } from '../database.types.ts';

/**
 * One field of a setting's value, from the JSON Schema the database checks values against
 * (`setting_key.value_schema`), so a key any lane adds gets its form without screen changes.
 * `isRequired`: whether the value must hold it; an optional field may be left empty (#604).
 */
export type SettingField = (
  /** `isMoney`: paise, typed and shown in rupees; `isChips`: in whole ₹50 chips. */
  | { readonly kind: 'integer'; readonly name: string; readonly min: number | null; readonly max: number | null; readonly isMoney: boolean; readonly isChips: boolean }
  | { readonly kind: 'boolean'; readonly name: string }
  | { readonly kind: 'choice'; readonly name: string; readonly options: readonly string[] }
  /** Any number of a fixed set, such as the connected social channels. */
  | { readonly kind: 'choices'; readonly name: string; readonly options: readonly string[] }
  /** A tier's id (`tier_id`), chosen from the venue's tiers. */
  | { readonly kind: 'tier'; readonly name: string }
  | { readonly kind: 'text'; readonly name: string }
) & { readonly isRequired: boolean };

/** A setting's value as stored: each field's number, switch, text or list. */
export type SettingValue = Readonly<Record<string, number | boolean | string | readonly string[]>>;

interface SchemaProperty {
  readonly type?: string;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly multipleOf?: number;
  readonly enum?: readonly string[];
  readonly items?: { readonly enum?: readonly string[] };
}

// A field held in whole ₹50 chips is money whatever its name (high_hand.payouts): its schema's multipleOf
// is @rivr/contracts' CHIP_PAISE. Named here, as a number the schema carries, because importing that module
// (or @rivr/domain/money, which reads the contracts) would put Zod and every schema in the player's first
// load, over its budget.
const CHIP_MULTIPLE = 5_000;

/** A number: money when named in paise or held in whole ₹50 chips. */
function numberField(name: string, property: SchemaProperty, isRequired: boolean): SettingField {
  const isChips = property.multipleOf === CHIP_MULTIPLE;
  const isMoney = name.endsWith('_paise') || isChips;
  return { kind: 'integer', name, min: property.minimum ?? null, max: property.maximum ?? null, isMoney, isChips, isRequired };
}

function toField(name: string, property: SchemaProperty, isRequired: boolean): SettingField {
  if (property.type === 'integer') return numberField(name, property, isRequired);
  if (property.type === 'boolean') return { kind: 'boolean', name, isRequired };
  if (property.type === 'array') return { kind: 'choices', name, options: property.items?.enum ?? [], isRequired };
  if (property.enum !== undefined) return { kind: 'choice', name, options: property.enum, isRequired };
  if (name === 'tier_id') return { kind: 'tier', name, isRequired };
  return { kind: 'text', name, isRequired };
}

/**
 * A key's fields, in the schema's order. Every key's schema is an object of named fields
 * (`settingValueJsonSchema` in @rivr/contracts writes them, and a migration stores them).
 */
export function toSettingFields(valueSchema: Json): SettingField[] {
  const schema = valueSchema as { properties?: Readonly<Record<string, SchemaProperty>>; required?: readonly string[] };
  const required = new Set(schema.required ?? []);
  return Object.entries(schema.properties ?? {}).map(([name, property]) => toField(name, property, required.has(name)));
}

/** A stored value. The database checked it against its key's schema, whose fields are numbers, switches, text or lists. */
export function toSettingValue(value: Json): SettingValue {
  return value as SettingValue;
}

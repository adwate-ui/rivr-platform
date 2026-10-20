import type { Json } from '../database.types.ts';

/**
 * One field of a setting's value, from the JSON Schema the database checks values against
 * (`setting_key.value_schema`), so a key any lane adds gets its form without screen changes.
 */
export type SettingField =
  /** `isMoney`: paise, typed and shown in rupees. */
  | { readonly kind: 'integer'; readonly name: string; readonly min: number | null; readonly max: number | null; readonly isMoney: boolean }
  | { readonly kind: 'boolean'; readonly name: string }
  | { readonly kind: 'choice'; readonly name: string; readonly options: readonly string[] }
  /** A tier's id (`tier_id`), chosen from the venue's tiers. */
  | { readonly kind: 'tier'; readonly name: string }
  | { readonly kind: 'text'; readonly name: string };

/** A setting's value as stored: each field's number, switch or text. */
export type SettingValue = Readonly<Record<string, number | boolean | string>>;

interface SchemaProperty {
  readonly type?: string;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly multipleOf?: number;
  readonly enum?: readonly string[];
}

// A field held in whole ₹50 chips is money whatever its name (high_hand.payouts): its schema's multipleOf
// is @rivr/contracts' CHIP_PAISE. Named here, as a number the schema carries, because importing that module
// (or @rivr/domain/money, which reads the contracts) would put Zod and every schema in the player's first
// load, over its budget.
const CHIP_MULTIPLE = 5_000;

function toField(name: string, property: SchemaProperty): SettingField {
  if (property.type === 'integer') {
    const isMoney = name.endsWith('_paise') || property.multipleOf === CHIP_MULTIPLE;
    return { kind: 'integer', name, min: property.minimum ?? null, max: property.maximum ?? null, isMoney };
  }
  if (property.type === 'boolean') return { kind: 'boolean', name };
  if (property.enum !== undefined) return { kind: 'choice', name, options: property.enum };
  if (name === 'tier_id') return { kind: 'tier', name };
  return { kind: 'text', name };
}

/**
 * A key's fields, in the schema's order. Every key's schema is an object of named fields
 * (`settingValueJsonSchema` in @rivr/contracts writes them, and a migration stores them).
 */
export function toSettingFields(valueSchema: Json): SettingField[] {
  const schema = valueSchema as { properties?: Readonly<Record<string, SchemaProperty>> };
  return Object.entries(schema.properties ?? {}).map(([name, property]) => toField(name, property));
}

/** A stored value. The database checked it against its key's schema, whose fields are numbers, switches or text. */
export function toSettingValue(value: Json): SettingValue {
  return value as SettingValue;
}

/**
 * Effective-dated settings: rules that change over time without a release, where a
 * transaction must use the rule in force at its own timestamp (.claude/rules/money.md).
 * Each key has a Zod schema for its value; the `setting_key` table stores the same schema as
 * JSON Schema and the database rejects values that do not match. Lanes add keys here and in a
 * migration (rake, caps, TDS, GST, bonuses, credit limits, waitlist priority weights).
 */
import { z } from 'zod';

/** What a setting applies to: the whole venue, or one table type, stake, tier or role. */
export const SETTING_SCOPES = ['venue', 'table_type', 'stake', 'tier', 'role'] as const;
export type SettingScope = (typeof SETTING_SCOPES)[number];

/** One setting key: its scope and the schema its value must satisfy. */
export interface SettingDefinition<Schema extends z.ZodType = z.ZodType> {
  readonly key: string;
  readonly description: string;
  readonly scope: SettingScope;
  readonly value: Schema;
}

const callTimeMinutes = {
  key: 'call_time.minutes',
  description: 'Minutes a player must play after being seated before leaving, per table type (features, "Call time").',
  scope: 'table_type',
  value: z.strictObject({ minutes: z.int().min(0).max(24 * 60) }),
} as const satisfies SettingDefinition;

const defaultTier = {
  key: 'tier.default',
  description: 'The tier every new member starts in (additions, "Tier-gated features").',
  scope: 'venue',
  value: z.strictObject({ tier_id: z.uuid() }),
} as const satisfies SettingDefinition;

const kycMinimumAge = {
  key: 'kyc.minimum_age',
  description: 'The age a member must have reached to be verified and to play; never below 18 (scope-v1 module 1, "18+ gate").',
  scope: 'venue',
  value: z.strictObject({ years: z.int().min(18).max(25) }),
} as const satisfies SettingDefinition;

const academyPrice = {
  key: 'academy.price',
  description: 'Academy fees in paise: one seat, and per head in a corporate booking (scope-v1 module 15).',
  scope: 'venue',
  value: z.strictObject({
    individual_paise: z.int().min(1).max(10_000_000),
    corporate_per_head_paise: z.int().min(1).max(10_000_000),
  }),
} as const satisfies SettingDefinition;

/** A ₹50 chip, in paise: rake caps, jackpot drops and pots are whole chips (additions, "Chips"). */
export const CHIP_PAISE = 5_000;

const rakeConfig = {
  key: 'rake.config',
  description: 'Rake per table type: the rate of the pot in basis points (500 is 5%) and the cap in paise, in whole ₹50 chips (scope-v1 module 3).',
  scope: 'table_type',
  value: z.strictObject({
    rate_basis_points: z.int().min(0).max(1_000),
    cap_paise: z.int().min(0).max(10_000_000).multipleOf(CHIP_PAISE),
  }),
} as const satisfies SettingDefinition;

const jackpotDrop = {
  key: 'jackpot.drop',
  description: 'The bad-beat jackpot drop while the jackpot is live: paise from every pot above the threshold, in whole ₹50 chips (scope-v1 module 4).',
  scope: 'venue',
  value: z.strictObject({
    drop_paise: z.int().min(0).max(100_000).multipleOf(CHIP_PAISE),
    above_paise: z.int().min(0).max(100_000_000).multipleOf(CHIP_PAISE),
  }),
} as const satisfies SettingDefinition;

const waitlistPriorityWeights = {
  key: 'waitlist.priority_weights',
  description: "A tier's waitlist priority: its weight (higher goes first; 0 or unset is none) and whether it counts only on the list for the member's qualifying stake, as the black card's does (scope-v1 module 2).",
  scope: 'tier',
  value: z.strictObject({
    weight: z.int().min(0).max(100),
    only_at_qualifying_stake: z.boolean(),
  }),
} as const satisfies SettingDefinition;

const waitlistHoldMinutes = {
  key: 'waitlist.hold_minutes',
  description: 'How long a called seat is held, and how long a member who steps away keeps their place, in minutes (scope-v1 module 2).',
  scope: 'venue',
  value: z.strictObject({ minutes: z.int().min(1).max(120) }),
} as const satisfies SettingDefinition;

/** Every setting key declared in code. */
export const SETTINGS = [callTimeMinutes, defaultTier, kycMinimumAge, academyPrice, rakeConfig, jackpotDrop, waitlistPriorityWeights, waitlistHoldMinutes] as const;

/** A setting key declared in code. */
export type SettingKey = (typeof SETTINGS)[number]['key'];

/** The JSON Schema the database stores for a setting's value. */
export function settingValueJsonSchema(definition: SettingDefinition): Record<string, unknown> {
  const { $schema: _ignored, ...schema } = z.toJSONSchema(definition.value);
  return schema;
}

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
  // The database's schema cannot compare the two; check_setting refuses a threshold below the drop (#296).
  value: z
    .strictObject({
      drop_paise: z.int().min(0).max(100_000).multipleOf(CHIP_PAISE),
      above_paise: z.int().min(0).max(100_000_000).multipleOf(CHIP_PAISE),
    })
    .refine((rule) => rule.above_paise >= rule.drop_paise),
} as const satisfies SettingDefinition;

const jackpotShares = {
  key: 'jackpot.shares',
  description: 'The season and freeroll pools\' shares of every jackpot drop, in basis points (2000 is 20%), up to 50% each; the main pool takes the rest (additions, "Jackpot sub-pools").',
  scope: 'venue',
  value: z.strictObject({
    season_basis_points: z.int().min(0).max(5_000),
    freeroll_basis_points: z.int().min(0).max(5_000),
  }),
} as const satisfies SettingDefinition;

const jackpotPayout = {
  key: 'jackpot.payout',
  description: 'How a bad beat pays, in basis points: the share of the main pool paid, and its split between the loser, the winner and the other players dealt in, which together make 100% (scope-v1 module 8).',
  scope: 'venue',
  // The database's schema cannot add the split up; pay_bad_beat refuses a rule whose split is not 100%.
  value: z
    .strictObject({
      pool_basis_points: z.int().min(0).max(10_000),
      loser_basis_points: z.int().min(0).max(10_000),
      winner_basis_points: z.int().min(0).max(10_000),
      table_basis_points: z.int().min(0).max(10_000),
    })
    .refine((rule) => rule.loser_basis_points + rule.winner_basis_points + rule.table_basis_points === 10_000),
} as const satisfies SettingDefinition;

const highHandPayouts = {
  key: 'high_hand.payouts',
  description: 'What each high hand pays, in paise, in whole ₹50 chips: royal flush, straight flush and four of a kind; 0 pays nothing (scope-v1 module 8).',
  scope: 'venue',
  value: z.strictObject({
    royal_flush: z.int().min(0).max(10_000_000).multipleOf(CHIP_PAISE),
    straight_flush: z.int().min(0).max(10_000_000).multipleOf(CHIP_PAISE),
    four_of_a_kind: z.int().min(0).max(10_000_000).multipleOf(CHIP_PAISE),
  }),
} as const satisfies SettingDefinition;

const dealerVarianceThreshold = {
  key: 'dealer.variance_threshold',
  description: 'How far a down\'s drop-box count may differ from the rake and jackpot drops logged in its hands, either way, before an alert is raised: paise, in whole ₹50 chips (scope-v1 module 4).',
  scope: 'venue',
  value: z.strictObject({ threshold_paise: z.int().min(0).max(10_000_000).multipleOf(CHIP_PAISE) }),
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

const creditConfig = {
  key: 'credit.config',
  description: 'Credit lines: a limit above the approval threshold waits for a super admin; a member needs the minimum visits before any limit; open markers across the room stay within the exposure cap. Paise in whole ₹50 chips (scope-v1 module 5).',
  scope: 'venue',
  value: z.strictObject({
    approval_threshold_paise: z.int().min(0).max(100_000_000).multipleOf(CHIP_PAISE),
    minimum_visits: z.int().min(0).max(100),
    exposure_cap_paise: z.int().min(0).max(1_000_000_000).multipleOf(CHIP_PAISE),
  }),
} as const satisfies SettingDefinition;

const markersDueDays = {
  key: 'markers.due_days',
  description: 'How many days after it is issued a marker falls due; a member with a marker past due gets no new credit (scope-v1 module 5).',
  scope: 'venue',
  value: z.strictObject({ days: z.int().min(1).max(90) }),
} as const satisfies SettingDefinition;

const cageSecondApproverThreshold = {
  key: 'cage.second_approver_threshold',
  description: 'Dual control: a withdrawal of this amount or more is paid only once a second approver, a different staff member holding cage.second_approve, has approved it. Paise in whole ₹50 chips (scope-v1 module 5; decision 0063).',
  scope: 'venue',
  value: z.strictObject({ threshold_paise: z.int().min(0).max(1_000_000_000).multipleOf(CHIP_PAISE) }),
} as const satisfies SettingDefinition;

/** How a TDS period runs: one visit, the venue's calendar day, or the financial year from 1 April. */
export const TDS_BASES = ['session', 'day', 'financial_year'] as const;

const tdsConfig = {
  key: 'tds.config',
  description: 'TDS on winnings (scope-v1 module 5, "TDS engine"): the switch (while off, every cash-out still records shadow TDS), the section, the rate in basis points (3000 is 30%), the threshold the period\'s net winnings must exceed, the basis (per session, day or financial year), and whether a PAN must be on record, with the rate for a member without one.',
  scope: 'venue',
  value: z.strictObject({
    enabled: z.boolean(),
    section: z.string().regex(/^[0-9]{3}[A-Z]{0,2}$/),
    rate_basis_points: z.int().min(0).max(10_000),
    threshold_paise: z.int().min(0).max(10_000_000_000),
    basis: z.enum(TDS_BASES),
    pan_required: z.boolean(),
    no_pan_rate_basis_points: z.int().min(0).max(10_000),
  }),
} as const satisfies SettingDefinition;

/** What the club's GST is charged on (tech plan item 20): the rake, or a table fee. */
export const GST_BASES = ['rake', 'table_fee'] as const;

const gstConfig = {
  key: 'gst.config',
  description: 'GST on the club\'s own supply (tech plan item 20; #23, decision 0071): the rate in basis points (1800 is 18%), taken out of what is collected, and the basis it is charged on (the rake or a table fee).',
  scope: 'venue',
  value: z.strictObject({
    rate_basis_points: z.int().min(0).max(10_000),
    basis: z.enum(GST_BASES),
  }),
} as const satisfies SettingDefinition;

const academyGst = {
  key: 'academy.gst',
  description: 'GST on the Academy\'s fees (decision 0114): the rate in basis points (1800 is 18%), taken out of the fee, kept apart from gst.config, the rake\'s, as training may be taxed differently (question 431).',
  scope: 'venue',
  value: z.strictObject({ rate_basis_points: z.int().min(0).max(10_000) }),
} as const satisfies SettingDefinition;

const pointsPerHour = {
  key: 'points.per_hour',
  description: 'Points a member earns for each hour played, per table type, so by stake (#89, decision 0161); none set earns none.',
  scope: 'table_type',
  value: z.strictObject({ points: z.int().min(0).max(10_000) }),
} as const satisfies SettingDefinition;

const pointsRewardsRakeShare = {
  key: 'points.rewards_rake_share',
  description: 'RIVR Rewards (#89, decision 0161): the share of a member\'s rake, in basis points (500 is 5%), earned as points at one a rupee; none set earns none.',
  scope: 'venue',
  value: z.strictObject({ basis_points: z.int().min(0).max(10_000) }),
} as const satisfies SettingDefinition;

const leaguePoints = {
  key: 'league.points',
  description: 'RIVR League points for a tournament finish (decision 0182): every finisher\'s for taking part, and more for first, second, third and the rest of the final table (fourth to ninth); none set earns none.',
  scope: 'venue',
  value: z.strictObject({
    first: z.int().min(0).max(100_000),
    second: z.int().min(0).max(100_000),
    third: z.int().min(0).max(100_000),
    final_table: z.int().min(0).max(100_000),
    entry: z.int().min(0).max(100_000),
  }),
} as const satisfies SettingDefinition;

const waitlistInterestToOpen = {
  key: 'waitlist.interest_to_open',
  description: 'Interest lists (decision 0184): how many members waiting for a game with no open table tell the floor to open one; none set never tells.',
  scope: 'venue',
  value: z.strictObject({ players: z.int().min(2).max(10) }),
} as const satisfies SettingDefinition;

const cardQrRotationSeconds = {
  key: 'card.qr_rotation_seconds',
  description: 'How often the membership card\'s QR changes, in seconds; a code from before a change no longer checks in (#71). 30 unless set.',
  scope: 'venue',
  value: z.strictObject({ seconds: z.int().min(10).max(300) }),
} as const satisfies SettingDefinition;

const alertThresholds = {
  key: 'alert.thresholds',
  description: 'Alerting (decision 0191): this many outbox deliveries failing for good within the window alerts the owner. 5 within 60 minutes unless set.',
  scope: 'venue',
  value: z.strictObject({ failed_deliveries: z.int().min(1).max(1000), window_minutes: z.int().min(5).max(1440) }),
} as const satisfies SettingDefinition;

/** Every setting key declared in code. */
export const SETTINGS = [
  callTimeMinutes, defaultTier, kycMinimumAge, academyPrice, rakeConfig, jackpotDrop, jackpotShares, jackpotPayout, highHandPayouts, dealerVarianceThreshold, waitlistPriorityWeights, waitlistHoldMinutes,
  creditConfig, markersDueDays, cageSecondApproverThreshold, tdsConfig, gstConfig, academyGst, pointsPerHour, pointsRewardsRakeShare,
  cardQrRotationSeconds, leaguePoints, waitlistInterestToOpen, alertThresholds,
] as const;

/** A setting key declared in code. */
export type SettingKey = (typeof SETTINGS)[number]['key'];

/** The JSON Schema the database stores for a setting's value. */
export function settingValueJsonSchema(definition: SettingDefinition): Record<string, unknown> {
  const { $schema: _ignored, ...schema } = z.toJSONSchema(definition.value);
  return schema;
}

import { z } from 'zod';

/** What sets a promotion rule off (scope-v1 module 7): the event a lane passes to `private.evaluate_promotions`. */
export const PROMOTION_TRIGGERS = [
  'buy_in', 'hours_played', 'hand_logged', 'tournament_entry', 'referral', 'check_in', 'graduation', 'date_window',
] as const;
export type PromotionTrigger = (typeof PROMOTION_TRIGGERS)[number];

/** What a promotion rule gives (scope-v1 module 7, additions "Spin wheel"). */
export const PROMOTION_EFFECTS = [
  'bonus', 'points', 'freeroll_ticket', 'cab_eligibility', 'physical_prize', 'jackpot_payout', 'message', 'spin',
] as const;
export type PromotionEffectKind = (typeof PROMOTION_EFFECTS)[number];

// A 24-hour IST time, "14:00".
const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
// Tier and table ids. The builder offers only the venue's; an id that is no longer one matches nobody.
const idList = z.array(z.string().min(1).max(64)).min(1);
// Paise in a jsonb number: at most ₹1 crore, in whole ₹50 chips where chips are paid.
const chipPaise = z.int().min(5_000).max(1_000_000_000).multipleOf(5_000);
const expiresDays = z.int().min(1).max(90);

/** The hands a hand-logged rule can name: the high hands the club pays (#47) and a bad beat (#48). */
export const PROMOTION_HANDS = ['four_of_a_kind', 'straight_flush', 'royal_flush', 'bad_beat'] as const;

// Minutes into the club's day, which begins at 06:00 IST: a window must open before it closes within one.
function clubMinute(time: string): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return (hours * 60 + minutes + 18 * 60) % (24 * 60);
}

/**
 * Who a rule is for and when, as `promotion_rule.conditions` holds it: every condition given must
 * hold, so none at all holds always. Days and times are the club's (its day runs 06:00 to 06:00 IST),
 * so Tuesday 22:00 to 04:00 is one window; a window is given whole and opens before it closes. The
 * database checks the same shape.
 */
export const promotionConditionsSchema = z
  .strictObject({
    tier_ids: idList.optional(),
    // Table type codes, such as nlh_100_200.
    stakes: z.array(z.string().regex(/^[a-z0-9_]{2,40}$/)).min(1).optional(),
    table_ids: idList.optional(),
    // ISO days: 1 is Monday, 7 Sunday.
    days: z.array(z.int().min(1).max(7)).min(1).optional(),
    from: clockTime.optional(),
    until: clockTime.optional(),
    first_n: z.strictObject({ count: z.int().min(1).max(1_000), per: z.enum(['table', 'day']) }).optional(),
    new_player: z.literal(true).optional(),
    lapsed_days: z.int().min(1).max(365).optional(),
    min_visits_in_month: z.int().min(1).max(31).optional(),
    call_time_complete: z.literal(true).optional(),
    // Hours played this visit, for an hours-played rule.
    min_hours: z.int().min(1).max(24).optional(),
    hands: z.array(z.enum(PROMOTION_HANDS)).min(1).optional(),
  })
  .refine(({ from, until }) => (from === undefined || until === undefined ? from === until : clubMinute(from) < (clubMinute(until) || 24 * 60)), {
    path: ['until'],
  });
export type PromotionConditions = z.infer<typeof promotionConditionsSchema>;

/**
 * What a rule gives, as `promotion_rule.effect` holds it. A bonus is a fixed amount or a share of the
 * buy-in in basis points (2000 is 20%) with an optional cap, and ends after some days; points are a
 * fixed number or a multiplier of the points earned (200 is double). The database checks the same shape.
 */
export const promotionEffectSchema = z.union([
  z.strictObject({ kind: z.literal('bonus'), amount_paise: chipPaise, expires_days: expiresDays }),
  z.strictObject({ kind: z.literal('bonus'), percent_bps: z.int().min(1).max(10_000), cap_paise: chipPaise.optional(), expires_days: expiresDays }),
  z.strictObject({ kind: z.literal('points'), points: z.int().min(1).max(1_000_000) }),
  z.strictObject({ kind: z.literal('points'), multiplier_percent: z.int().min(101).max(1_000) }),
  z.strictObject({ kind: z.literal('freeroll_ticket'), tournament: z.string().trim().min(1).max(80) }),
  z.strictObject({ kind: z.literal('cab_eligibility') }),
  z.strictObject({ kind: z.literal('physical_prize'), prize: z.string().trim().min(1).max(80), value_paise: z.int().min(0).max(1_000_000_000).optional() }),
  z.strictObject({ kind: z.literal('jackpot_payout'), pool: z.enum(['main', 'season', 'freeroll']), amount_paise: chipPaise }),
  z.strictObject({ kind: z.literal('message'), text: z.string().trim().min(1).max(500) }),
  z.strictObject({ kind: z.literal('spin') }),
]);
export type PromotionEffect = z.infer<typeof promotionEffectSchema>;

/**
 * Last week's events for a promotion's simulation (#144), as `promotion_replay` returns them: the seven
 * whole club days before today's, and each buy-in or closed visit's time, member (a number within the
 * replay, never an id), tier, table, stake, own money in paise (₹0 when paid from bonus), points earned and
 * hours played.
 */
export const promotionReplaySchema = z.strictObject({
  from: z.iso.datetime({ offset: true }),
  to: z.iso.datetime({ offset: true }),
  events: z.array(z.strictObject({
    at: z.iso.datetime({ offset: true }),
    member: z.int().min(1),
    tier_id: z.string().nullable(),
    table_id: z.string().nullable(),
    stake: z.string().nullable(),
    amount_paise: z.int().min(0),
    points: z.int().min(0),
    hours_played: z.number().min(0),
  })),
});
export type PromotionReplay = z.infer<typeof promotionReplaySchema>;

/** The builder's rewards (#84), as the prototype offers them: double or triple points on hours played, or 10% of a buy-in as bonus. */
export const PROMOTION_BUILDER_REWARDS = ['double_points', 'triple_points', 'buy_in_bonus'] as const;
export type PromotionBuilderReward = (typeof PROMOTION_BUILDER_REWARDS)[number];

/** The builder's limits (#84): none, the first 50 a club day, or once for each member. */
export const PROMOTION_BUILDER_LIMITS = ['none', 'first_50', 'once_per_member'] as const;
export type PromotionBuilderLimit = (typeof PROMOTION_BUILDER_LIMITS)[number];

/**
 * The builder's four blocks as the console's form holds them (#84; design prompt Promotions): When
 * (club days, none for every day, and an IST window given whole), Who (a table type's code, or null
 * for every stake), Reward and Limits.
 */
export const promotionBuilderSchema = z
  .strictObject({
    days: z.array(z.int().min(1).max(7)),
    from: clockTime.nullable(),
    until: clockTime.nullable(),
    stake: z.string().regex(/^[a-z0-9_]{2,40}$/).nullable(),
    reward: z.enum(PROMOTION_BUILDER_REWARDS),
    limit: z.enum(PROMOTION_BUILDER_LIMITS),
    // The most a 10% buy-in bonus gives on one buy-in, in whole rupees of ₹50 chips (question #415).
    bonus_cap_rupees: z.int().min(50).max(100_000).multipleOf(50),
  })
  .refine(({ from, until }) => (from === null || until === null ? from === until : clubMinute(from) < (clubMinute(until) || 24 * 60)), {
    path: ['until'],
  });
export type PromotionBuilder = z.infer<typeof promotionBuilderSchema>;

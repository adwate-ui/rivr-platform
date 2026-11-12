import { z } from 'zod';

/**
 * The typed promotion model (console v3, phase 7; decision 0472): what a promotion's version gives (Reward), to whom
 * (Eligibility), when (Schedule), how often (Limits) and where it shows (Channels). Rewards are points, bonus chips,
 * spins and perks, never rupees or paise (decision 0284). `promotion_version` holds each part as jsonb, and the database
 * checks the same shapes.
 */

// Bonus chips in whole 50s, the smallest chip: "1,000 bonus chips" is 1000.
const chips = z.int().min(50).max(10_000_000).multipleOf(50);
// Minutes played, in half hours as the builder offers them.
const minutesPlayed = z.int().min(30).max(1_440).multipleOf(30);
// A play-time bonus's steps (owner, 8 Nov): two to six, each later than the one before; one step is the plain form.
const hourSteps = z.array(z.strictObject({ afterMinutes: minutesPlayed, chips })).min(2).max(6)
  .refine((steps) => steps.every((step, at) => at === 0 || step.afterMinutes > (steps[at - 1]?.afterMinutes ?? 0)));
const firstN = z.int().min(1).max(100);
// A seat bonus in tiers (the owner, 12 Nov; decision 0580): the first `count` members to claim it get `chips`, the next
// tier's count the next, and so on, over the promotion's life; one to ten tiers.
const seatTiers = z.array(z.strictObject({ count: z.int().min(1).max(10_000), chips })).min(1).max(10);
// A 24-hour IST time, "20:00".
const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const id = z.string().min(1).max(64);

/** What bonus chips are given on. */
export const BONUS_CHIPS_ON = ['visit', 'first_buyin', 'referral', 'signup'] as const;

// 1.25 to 5, in quarters: 2 is double points, 3 triple.
const multiplier = z.number().min(1.25).max(5).refine((value) => Number.isInteger(value * 4));

export const rewardSchema = z.union([
  z.strictObject({ kind: z.literal('points_multiplier'), multiplier }),
  z.strictObject({
    kind: z.literal('buyin_bonus'), mode: z.literal('percent'), percent: z.int().min(1).max(100), capChips: chips.optional(),
    firstNBuyinsPerTable: firstN.optional(),
  }),
  z.strictObject({ kind: z.literal('buyin_bonus'), mode: z.literal('fixed'), chips, firstNBuyinsPerTable: firstN.optional() }),
  // On the seat (owner, 8 Nov): fixed chips on the first seat of a visit, or on each of the first N seats at a table in a club day.
  // A buy-in bonus above is kept for what was published; nothing records a buy-in since the Cage was hidden, and the builder offers none.
  z.strictObject({ kind: z.literal('seat_bonus'), chips, firstNSeatsPerTable: firstN.optional() }),
  // Or in tiers (owner, 12 Nov), on a member's first seat of a visit, once a member: promotionTermsSchema holds it to once.
  z.strictObject({ kind: z.literal('seat_bonus'), tiers: seatTiers }),
  // Play time pays as each step is reached while seated (owner, 8 Nov): once after a time, at set steps, or every so often.
  z.strictObject({ kind: z.literal('hours_bonus'), chips, afterMinutes: minutesPlayed }),
  z.strictObject({ kind: z.literal('hours_bonus'), mode: z.literal('steps'), steps: hourSteps }),
  z.strictObject({
    kind: z.literal('hours_bonus'), mode: z.literal('every'), everyMinutes: minutesPlayed.max(720), chips,
    timesPerVisit: z.int().min(1).max(20).optional(),
  }),
  z.strictObject({ kind: z.literal('bonus_chips'), chips, on: z.enum(BONUS_CHIPS_ON) }),
  z.strictObject({ kind: z.literal('free_spin'), spins: z.int().min(1).max(10), afterMinutes: minutesPlayed }),
  z.strictObject({ kind: z.literal('cab_home'), fromVisitInMonth: z.int().min(1).max(31) }),
  z.strictObject({ kind: z.literal('tournament_entry'), tournamentId: z.string().trim().min(1).max(80) }),
  z.strictObject({ kind: z.literal('waitlist_priority') }),
]);
export type Reward = z.infer<typeof rewardSchema>;

/**
 * Who a promotion is for beyond stakes and tiers: everyone, members in their first 30 days or lapsed regulars. No gender
 * is recorded, so there is no audience of women (owner, 3 Nov).
 */
export const AUDIENCES = ['everyone', 'new_30d', 'lapsed'] as const;

export const eligibilitySchema = z.strictObject({
  // Table type codes, such as nlh_100_200.
  stakes: z.union([z.literal('all'), z.array(z.string().regex(/^[a-z0-9_]{2,40}$/)).min(1)]),
  tableIds: z.array(id).min(1).optional(),
  tiers: z.union([z.literal('all'), z.array(id).min(1)]),
  audience: z.enum(AUDIENCES),
});
export type Eligibility = z.infer<typeof eligibilitySchema>;

/**
 * When it runs, on the club's days (06:00 to 06:00 IST): on each listed day (ISO, 1 Monday to 7 Sunday) from its start
 * day to its end day, an opening from `from` to the next `to`, so 20:00 to 02:00 crosses midnight; the same time at
 * both ends is 24 hours.
 */
export const scheduleSchema = z
  .strictObject({
    days: z.array(z.int().min(1).max(7)).min(1).max(7).refine((days) => new Set(days).size === days.length),
    from: clockTime,
    to: clockTime,
    startsOn: z.iso.date(),
    endsOn: z.iso.date().optional(),
    timezone: z.literal('Asia/Kolkata'),
  })
  .refine(({ startsOn, endsOn }) => endsOn === undefined || endsOn >= startsOn, { path: ['endsOn'] });
export type Schedule = z.infer<typeof scheduleSchema>;

/** How often one member may have it: no limit, once a visit, a club day, a club week, or once ever. */
export const PER_MEMBER = ['none', 'per_visit', 'per_day', 'per_week', 'once'] as const;

/** How long the budget and the most grants run: the whole promotion (left out), or each calendar month of club days. */
export const BUDGET_PERIODS = ['month'] as const;

/**
 * How often and how much (decision 0499): per member, up to `timesPerMember` times in each period (2 to 20; left out,
 * once), which needs a period; the most members a club day; and a budget in bonus chips and the most grants, for the
 * whole promotion or, with `budgetPeriod` `month`, afresh each calendar month, which needs one of the two.
 */
export const limitsSchema = z
  .strictObject({
    perMember: z.enum(PER_MEMBER),
    timesPerMember: z.int().min(2).max(20).optional(),
    maxMembersPerDay: z.int().min(1).max(10_000).optional(),
    budgetChips: chips.optional(),
    maxGrants: z.int().min(1).max(1_000_000).optional(),
    budgetPeriod: z.enum(BUDGET_PERIODS).optional(),
  })
  .refine(({ perMember, timesPerMember }) => timesPerMember === undefined || perMember !== 'none', { path: ['timesPerMember'] })
  .refine(({ budgetPeriod, budgetChips, maxGrants }) => budgetPeriod === undefined || budgetChips !== undefined || maxGrants !== undefined,
    { path: ['budgetPeriod'] });
export type Limits = z.infer<typeof limitsSchema>;

export const channelsSchema = z.strictObject({ playerApp: z.boolean(), tv: z.boolean(), website: z.boolean(), whatsapp: z.boolean() });
export type Channels = z.infer<typeof channelsSchema>;

/** One version's terms, as the builder saves them and the approver reads them. */
export const promotionTermsSchema = z.strictObject({
  name: z.string().trim().min(3).max(80),
  reward: rewardSchema,
  eligibility: eligibilitySchema,
  schedule: scheduleSchema,
  limits: limitsSchema,
  channels: channelsSchema,
  // The rules on the website, one a line (decision 0283).
  rulesText: z.array(z.string().trim().min(1).max(200)).max(12),
  // The card's link (#776): a plain https address, so the host the approver reads is the one the card opens.
  link: z.string().max(500).regex(/^https:\/\/[A-Za-z0-9.-]+(:[0-9]{1,5})?([/?#][!-~]*)?$/).optional(),
})
  // A seat bonus in tiers counts its claims over the promotion's life, each member once (decision 0580): no monthly reset.
  .refine(({ reward, limits }) => !('tiers' in reward)
    || (limits.perMember === 'once' && limits.timesPerMember === undefined && limits.budgetPeriod !== 'month'),
    { path: ['limits', 'perMember'] });
export type PromotionTerms = z.infer<typeof promotionTermsSchema>;

/** A version's status: drafted, waiting for a second person, approved for a later day, running, paused or over. */
export const PROMOTION_STATUSES = ['draft', 'awaiting_approval', 'scheduled', 'live', 'paused', 'ended'] as const;
export type PromotionStatus = (typeof PROMOTION_STATUSES)[number];

const eventBase = {
  // The event, once: 'buy_in:' and the cage transaction, 'seated:' and the seat, 'hours_played:' and the visit, 'hours_step:' the visit and step.
  key: z.string().min(1).max(200),
  at: z.iso.datetime({ offset: true }),
  memberId: id,
  visitId: id.nullable(),
  tableId: id.nullable(),
  stake: z.string().nullable(),
};

/**
 * An event a promotion weighs, as the engine and last week's replay give it: a buy-in (the member's own chips, 0 when
 * paid from bonus), time played (the minutes inside the version's schedule at its stakes and tables, and the points
 * earned in them), a play-time bonus step reached, a visit (its number in the calendar month), a referral or a sign-up.
 */
export const promotionEventSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...eventBase, kind: z.literal('buy_in'), ownChips: z.int().min(0), isFirstOfVisit: z.boolean() }),
  // A seat past its Undo: whether it is the first of the visit.
  z.strictObject({ ...eventBase, kind: z.literal('seated'), isFirstOfVisit: z.boolean() }),
  z.strictObject({ ...eventBase, kind: z.literal('time_played'), minutes: z.int().min(0), points: z.int().min(0) }),
  // A play-time bonus step reached (owner, 8 Nov): the minutes played so far, and the step's own minutes.
  z.strictObject({ ...eventBase, kind: z.literal('hours_step'), minutes: z.int().min(0), stepMinutes: minutesPlayed }),
  z.strictObject({ ...eventBase, kind: z.literal('visit'), visitInMonth: z.int().min(1) }),
  z.strictObject({ ...eventBase, kind: z.literal('referral') }),
  z.strictObject({ ...eventBase, kind: z.literal('signup') }),
]);
export type PromotionEventJson = z.infer<typeof promotionEventSchema>;

/** What a promotion knows of the member: tier, whole days since joining and since the last visit before this one. */
export const memberFactsSchema = z.strictObject({
  tierId: id.nullable(),
  daysSinceJoined: z.int().min(0),
  daysSinceLastVisit: z.int().min(0).nullable(),
});
export type MemberFacts = z.infer<typeof memberFactsSchema>;

/** A simulation as the version stores it, for the approver: last week's members given it, times given and totals. */
export const promotionSimulationSchema = z.strictObject({
  events: z.int().min(0),
  membersQualified: z.int().min(0),
  timesGiven: z.int().min(0),
  points: z.int().min(0),
  chips: z.int().min(0),
  spins: z.int().min(0),
  perks: z.int().min(0),
  isBudgetReached: z.boolean(),
});
export type PromotionSimulationResult = z.infer<typeof promotionSimulationSchema>;

/** Last week replayed for a version (`promotion_version_replay`): its seven whole club days, and each event with its member. */
export const promotionVersionReplaySchema = z.strictObject({
  from: z.iso.datetime({ offset: true }),
  to: z.iso.datetime({ offset: true }),
  events: z.array(z.strictObject({ event: promotionEventSchema, member: memberFactsSchema })),
});
export type PromotionVersionReplay = z.infer<typeof promotionVersionReplaySchema>;

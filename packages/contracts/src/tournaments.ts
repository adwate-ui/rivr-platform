import { z } from 'zod';

/** How players buy into a tournament (#116, decision 0202): one entry, entries again after busting, or chips bought again. */
export const TOURNAMENT_FORMATS = ['freezeout', 're_entry', 'rebuy'] as const;
export type TournamentFormat = (typeof TOURNAMENT_FORMATS)[number];

/** How a bounty is paid on a bust (#117, decision 0206): all of it, or half with the rest on the eliminator's head. */
export const BOUNTY_KINDS = ['standard', 'progressive'] as const;

/** A whole number as typed, from `least` to `most`. */
const whole = (least: number, most: number) => z.string().trim().regex(/^\d{1,10}$/).transform(Number).pipe(z.int().min(least).max(most));
/** Whole rupees as typed; the database then checks ₹50 chips. */
const rupees = z.string().trim().regex(/^(0|[1-9]\d{0,8})$/);
/** Whole rupees, or blank for none. */
const optionalRupees = z.string().trim().regex(/^(|0|[1-9]\d{0,8})$/);
/** Blank, or whole rupees in ₹50 chips. */
const isChips = (rupees: string) => rupees.trim() === '' || Number(rupees) % 50 === 0;

const BLINDS = /^[1-9]\d{0,8}$/;
const ANTE = /^(0|[1-9]\d{0,8})$/;

/** What is wrong with a level's typed blinds and ante, by field. */
function levelIssues(row: { smallBlind: string; bigBlind: string; ante: string }): [field: 'smallBlind' | 'bigBlind' | 'ante', message: string][] {
  const issues: [field: 'smallBlind' | 'bigBlind' | 'ante', message: string][] = [];
  if (!BLINDS.test(row.smallBlind)) issues.push(['smallBlind', 'invalid']);
  if (!BLINDS.test(row.bigBlind)) issues.push(['bigBlind', 'invalid']);
  if (!ANTE.test(row.ante)) issues.push(['ante', 'invalid']);
  if (issues.length === 0 && Number(row.smallBlind) > Number(row.bigBlind)) issues.push(['smallBlind', 'above_big_blind']);
  return issues;
}

/**
 * A level or a break as the console's structure editor holds it, every figure as typed (a break's blinds
 * blank), read into the domain's stage. A level's small blind is at most its big blind; the clock's own
 * checks (@rivr/domain structureProblem) run on the whole.
 */
export const stageFormSchema = z.object({
  kind: z.enum(['level', 'break']),
  smallBlind: z.string().trim(),
  bigBlind: z.string().trim(),
  ante: z.string().trim(),
  minutes: whole(1, 120),
})
  .superRefine((row, context) => {
    if (row.kind === 'level') levelIssues(row).forEach(([field, message]) => context.addIssue({ code: 'custom', path: [field], message }));
  })
  .transform((row) => (row.kind === 'break' ? { kind: 'break' as const, minutes: row.minutes }
    : { kind: 'level' as const, smallBlind: Number(row.smallBlind), bigBlind: Number(row.bigBlind), ante: Number(row.ante), minutes: row.minutes }));

/** A blind structure as the console saves it: a name and one to sixty stages. */
export const blindStructureSchema = z.object({
  name: z.string().trim().min(1).max(80),
  stages: z.array(stageFormSchema).min(1).max(60),
});

/**
 * What the floor asks of the blind-structure calculator (#115): chips, entries, the first big blind, the
 * level's minutes, a target length in hours (to a tenth), a break after every so many levels and its
 * minutes, and whether there is a big-blind ante.
 */
export const structurePlanSchema = z.object({
  startingStack: whole(100, 10_000_000),
  expectedEntries: whole(2, 5_000),
  firstBigBlind: whole(100, 1_000_000),
  levelMinutes: whole(1, 120),
  targetHours: z.string().trim().regex(/^\d{1,2}(\.\d)?$/).transform((hours) => Math.round(Number(hours) * 60)).pipe(z.int().min(1).max(1_440)),
  breakEvery: whole(0, 30),
  breakMinutes: whole(0, 60),
  hasAnte: z.boolean(),
});

/**
 * A tournament template as the console keeps it (#115, #116): amounts in whole rupees in ₹50 chips, the
 * fee part of the buy-in and below it; the most buys blank for no limit and always blank in a freezeout;
 * an add-on's price, fee and chips all given or all blank, its fee below its price, and only with
 * registration past level 0; a guarantee blank for none; a bounty (#117) blank with no kind, or given
 * with its kind, below the buy-in less the fee, and never in a rebuy. The database checks the last
 * registration level against the structure's levels.
 */
export const tournamentTemplateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  format: z.enum(TOURNAMENT_FORMATS),
  buyIn: rupees,
  fee: rupees,
  startingStack: whole(1, 10_000_000),
  structureId: z.uuid(),
  lastRegistrationLevel: whole(0, 60),
  maxBuys: z.string().trim().regex(/^(|[1-9]\d?)$/),
  addOn: optionalRupees,
  addOnFee: optionalRupees,
  addOnChips: z.string().trim().regex(/^(|[1-9]\d{0,9})$/),
  placesPaid: whole(1, 100),
  guarantee: optionalRupees,
  bounty: optionalRupees,
  bountyKind: z.enum(['none', ...BOUNTY_KINDS]),
})
  .refine((template) => Number(template.fee) < Number(template.buyIn), { path: ['fee'], message: 'not_below_buy_in' })
  .refine((template) => template.format !== 'freezeout' || template.maxBuys === '', { path: ['maxBuys'], message: 'freezeout' })
  .refine((template) => new Set([template.addOn === '', template.addOnFee === '', template.addOnChips === '']).size === 1,
    { path: ['addOn'], message: 'add_on_incomplete' })
  .refine((template) => template.addOn === '' || template.lastRegistrationLevel >= 1, { path: ['addOn'], message: 'add_on_at_start' })
  .refine((template) => template.addOn === '' || template.addOnFee === '' || Number(template.addOnFee) < Number(template.addOn),
    { path: ['addOnFee'], message: 'not_below_add_on' })
  .refine((template) => [template.buyIn, template.fee, template.addOn, template.addOnFee, template.guarantee, template.bounty].every(isChips),
    { path: ['buyIn'], message: 'not_chips' })
  .refine((template) => (template.bounty === '') === (template.bountyKind === 'none'), { path: ['bounty'], message: 'bounty_incomplete' })
  .refine((template) => template.bounty === '' || template.format !== 'rebuy', { path: ['bounty'], message: 'bounty_rebuy' })
  .refine((template) => template.bounty === '' || Number(template.bounty) < Number(template.buyIn) - Number(template.fee),
    { path: ['bounty'], message: 'bounty_above_pool' });

/** One paid place's share of the prize pool as typed: percent, to two decimal places, read as basis points. */
export const sharePercentSchema = z.string().trim().regex(/^\d{1,3}(\.\d{1,2})?$/).transform((typed) => Math.round(Number(typed) * 100));

/**
 * Each paid place's share of the prize pool, first place first, as the floor sets them for a tournament
 * (#121, question #470): one to a hundred, each above nothing and none above the place before's, adding up
 * to 100%. Read as basis points.
 */
export const payoutSharesSchema = z.object({ shares: z.array(z.object({ percent: sharePercentSchema })).min(1).max(100) })
  .transform((form) => form.shares.map((share) => share.percent))
  .refine((shares) => shares.every((share, index) => share > 0 && share <= (shares[index - 1] ?? 10_000))
    && shares.reduce((sum, share) => sum + share, 0) === 10_000, { message: 'not_whole' });

/** How a deal shares the prizes left (#121): by the Independent Chip Model, or chip-chop. */
export const DEAL_METHODS = ['icm', 'chip_chop'] as const;

/** Each player left's chips as counted (#519, #524): a satellite's finish places them by it, a flight's bag takes them to Day 2. */
export const chipCountsSchema = z.object({
  stacks: z.array(z.object({ entryId: z.uuid(), chips: z.string().trim().regex(/^[1-9]\d{0,11}$/).transform(BigInt) })).min(1),
});

/** A deal among the players left (#121): its method, and each player's chips as counted. */
export const dealSchema = z.object({
  method: z.enum(DEAL_METHODS),
  stacks: z.array(z.object({ entryId: z.uuid(), chips: z.string().trim().regex(/^[1-9]\d{0,11}$/).transform(BigInt) })).min(2).max(9),
});

/** The room a tournament is played in (#120): 1 to 30 tables of 2 to 10 seats each, as typed. */
export const tournamentRoomSchema = z.object({ tables: whole(1, 30), seatsPerTable: whole(2, 10) });

/** What a player may buy (#116, #118). */
export const PURCHASES = ['entry', 're_entry', 'rebuy', 'add_on'] as const;

/** A buy taken in cash at the cage (#118): the member chosen and what they buy. */
export const cageBuySchema = z.object({ memberId: z.uuid(), purchase: z.enum(PURCHASES) });

/** A new tournament: its template, its name, its start as an IST date and 24-hour time, and whether members see it. */
export const newTournamentSchema = z.object({
  templateId: z.uuid(),
  name: z.string().trim().min(1).max(80),
  day: z.iso.date(),
  time: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  isPublished: z.boolean(),
});

/** An IST day (`2026-11-15`) and 24-hour time (`16:00`) as the moment it is. IST keeps no daylight saving. */
export function istMoment(day: string, time: string): Date {
  return new Date(`${day}T${time}:00+05:30`);
}

import { eligibilitySchema, limitsSchema, promotionTermsSchema, rewardSchema, scheduleSchema, type PromotionTerms } from '@rivr/contracts/promotionModel';
import type { Terms } from '@rivr/domain/promotions';
import type { BuilderForm } from './builderForm.ts';

/** A field the builder marks when the terms cannot take what it holds. */
export type FormField =
  | 'name' | 'multiplier' | 'percent' | 'capChips' | 'buyChips' | 'firstN' | 'chips' | 'afterHours' | 'everyHours' | 'timesPerVisit' | 'steps'
  | 'spins' | 'fromVisit' | 'tournament'
  | 'who' | 'days' | 'from' | 'to' | 'startsOn' | 'endsOn' | 'timesPerMember' | 'maxMembersPerDay' | 'budgetChips' | 'rulesText' | 'link';

/**
 * The builder read as terms: the whole version's when every field holds (`terms`), the four parts a summary and a
 * simulation need when those hold (`core`), and the fields to mark.
 */
export interface FormReading {
  readonly terms: PromotionTerms | null;
  readonly core: Terms | null;
  readonly errors: ReadonlySet<FormField>;
}

const numberOf = (typed: string): number | undefined => (typed.trim() === '' ? undefined : Number(typed.trim().replaceAll(',', '')));

function minutesOf(hours: string): number | undefined {
  const value = numberOf(hours);
  return value === undefined ? undefined : value * 60;
}

/** The object without its unset keys, so an optional field left blank is absent, as the stored terms have it. */
function defined(object: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}

function buyInOf(form: BuilderForm): Record<string, unknown> {
  const firstNBuyinsPerTable = numberOf(form.firstN);
  if (form.buyMode === 'fixed') return defined({ kind: form.kind, mode: 'fixed', chips: numberOf(form.buyChips), firstNBuyinsPerTable });
  return defined({ kind: form.kind, mode: 'percent', percent: numberOf(form.percent), capChips: numberOf(form.capChips), firstNBuyinsPerTable });
}

/**
 * A play-time bonus as typed (owner, 8 Nov): every so often with its cap; or at set times, its one step the plain form
 * and more steps a list.
 */
function hoursOf(form: BuilderForm): Record<string, unknown> {
  if (form.hoursMode === 'every') {
    return defined({ kind: form.kind, mode: 'every', everyMinutes: minutesOf(form.everyHours), chips: numberOf(form.chips), timesPerVisit: numberOf(form.timesPerVisit) });
  }
  const first = defined({ afterMinutes: minutesOf(form.afterHours), chips: numberOf(form.chips) });
  if (form.moreSteps.length === 0) return { kind: form.kind, ...first };
  return { kind: form.kind, mode: 'steps', steps: [first, ...form.moreSteps.map((step) => defined({ afterMinutes: minutesOf(step.afterHours), chips: numberOf(step.chips) }))] };
}

/** The reward the fields of its kind give. */
function rewardOf(form: BuilderForm): Record<string, unknown> {
  switch (form.kind) {
    case 'points_multiplier':
      return defined({ kind: form.kind, multiplier: numberOf(form.multiplier) });
    case 'buyin_bonus':
      return buyInOf(form);
    case 'hours_bonus':
      return hoursOf(form);
    case 'bonus_chips':
      return defined({ kind: form.kind, chips: numberOf(form.chips), on: form.bonusOn });
    case 'free_spin':
      return defined({ kind: form.kind, spins: numberOf(form.spins), afterMinutes: minutesOf(form.afterHours) });
    case 'cab_home':
      return defined({ kind: form.kind, fromVisitInMonth: numberOf(form.fromVisit) });
    case 'tournament_entry':
      return { kind: form.kind, tournamentId: form.tournament.trim() };
    default:
      return { kind: form.kind };
  }
}

// The reward's own keys and the field each is typed in; bonus chips are the buy-in's own field on a buy-in bonus.
const REWARD_FIELDS: Readonly<Record<string, FormField>> = {
  multiplier: 'multiplier', percent: 'percent', capChips: 'capChips', firstNBuyinsPerTable: 'firstN', afterMinutes: 'afterHours', spins: 'spins',
  fromVisitInMonth: 'fromVisit', tournamentId: 'tournament', everyMinutes: 'everyHours', timesPerVisit: 'timesPerVisit', steps: 'steps',
};

/** The mode of the shape the fields make: a buy-in's, or a play-time bonus's set steps or every so often; none for the rest. */
function modeOf(form: BuilderForm): string | undefined {
  if (form.kind === 'buyin_bonus') return form.buyMode;
  if (form.kind !== 'hours_bonus') return undefined;
  if (form.hoursMode === 'every') return 'every';
  return form.moreSteps.length > 0 ? 'steps' : undefined;
}

/** The one shape of the reward union for the kind (and its mode) chosen, so its refusals name their fields. */
function rewardShapeFor(form: BuilderForm) {
  const mode = modeOf(form);
  return rewardSchema.options.find((option) => option.shape.kind.value === form.kind && ('mode' in option.shape ? option.shape.mode.value === mode : mode === undefined));
}

function rewardErrors(form: BuilderForm, reward: Record<string, unknown>): FormField[] {
  const parsed = rewardShapeFor(form)?.safeParse(reward);
  if (parsed === undefined || parsed.success) return [];
  return parsed.error.issues.map(({ path }) => {
    const key = String(path[0]);
    if (key === 'chips') return form.kind === 'buyin_bonus' ? 'buyChips' : 'chips';
    return REWARD_FIELDS[key] ?? 'chips';
  });
}

/** A part read by its schema: taken, or refused with an issue for each key it refuses. */
type PartResult = { readonly success: true } | { readonly success: false; readonly error: { readonly issues: readonly { readonly path: readonly PropertyKey[] }[] } };

/** The fields a part's refusals name, by the part's own key; `fallback` for any other key, or nothing when it is null. */
function partErrors(result: PartResult, fields: Readonly<Record<string, FormField>>, fallback: FormField | null): FormField[] {
  if (result.success) return [];
  return result.error.issues.flatMap(({ path }) => {
    const field = fields[String(path[0])] ?? fallback;
    return field === null ? [] : [field];
  });
}

function scheduleOf(form: BuilderForm): Record<string, unknown> {
  return defined({
    days: [...form.days].sort((one, other) => one - other), from: form.from.trim(), to: form.to.trim(), startsOn: form.startsOn,
    endsOn: form.endsOn.trim() === '' ? undefined : form.endsOn.trim(), timezone: 'Asia/Kolkata',
  });
}

/**
 * The limits as typed (decision 0499): up to N times only with a period, and a month only with a budget or most grants
 * to count in it, so a choice the other fields make meaningless is left out rather than refused.
 */
function limitsOf(form: BuilderForm) {
  const budgetChips = numberOf(form.budgetChips);
  const hasBudget = budgetChips !== undefined || form.maxGrants !== undefined;
  return defined({
    perMember: form.perMember, timesPerMember: form.perMember === 'none' ? undefined : numberOf(form.timesPerMember),
    maxMembersPerDay: numberOf(form.maxMembersPerDay), budgetChips, maxGrants: form.maxGrants,
    budgetPeriod: form.budgetPeriod === 'month' && hasBudget ? 'month' as const : undefined,
  });
}

function partsOf(form: BuilderForm) {
  return {
    name: form.name,
    reward: rewardOf(form),
    eligibility: defined({ stakes: form.stakes, tableIds: form.tableIds, tiers: form.tiers, audience: form.audience }),
    schedule: scheduleOf(form),
    limits: limitsOf(form),
    channels: form.channels,
    rulesText: form.rulesText.split('\n').map((line) => line.trim()).filter((line) => line !== ''),
    ...(form.link.trim() === '' ? {} : { link: form.link.trim() }),
  };
}

const SCHEDULE_FIELDS: Readonly<Record<string, FormField>> = { days: 'days', from: 'from', to: 'to', startsOn: 'startsOn', endsOn: 'endsOn' };
const LIMIT_FIELDS: Readonly<Record<string, FormField>> = {
  timesPerMember: 'timesPerMember', maxMembersPerDay: 'maxMembersPerDay', budgetChips: 'budgetChips',
};
// The words around the terms, checked with the whole version.
const WORD_FIELDS: Readonly<Record<string, FormField>> = { name: 'name', rulesText: 'rulesText', link: 'link' };

/** The four parts a summary and a simulation read, once each holds: the contracts' own shapes. */
function coreOf(parts: ReturnType<typeof partsOf>): Terms {
  return {
    reward: rewardSchema.parse(parts.reward), eligibility: eligibilitySchema.parse(parts.eligibility), schedule: scheduleSchema.parse(parts.schedule),
    limits: limitsSchema.parse(parts.limits),
  };
}

/**
 * Reads the builder as a version's terms (`@rivr/contracts` promotionTermsSchema), part by part, so each refusal marks
 * the field it is about.
 */
export function readForm(form: BuilderForm): FormReading {
  const parts = partsOf(form);
  const whole = promotionTermsSchema.safeParse(parts);
  if (whole.success) return { terms: whole.data, core: whole.data, errors: new Set() };
  const coreErrors = [
    ...rewardErrors(form, parts.reward),
    ...partErrors(eligibilitySchema.safeParse(parts.eligibility), {}, 'who'),
    ...partErrors(scheduleSchema.safeParse(parts.schedule), SCHEDULE_FIELDS, 'startsOn'),
    ...partErrors(limitsSchema.safeParse(parts.limits), LIMIT_FIELDS, 'budgetChips'),
  ];
  const errors = new Set([...coreErrors, ...partErrors(whole, WORD_FIELDS, null)]);
  return { terms: null, core: coreErrors.length === 0 ? coreOf(parts) : null, errors };
}

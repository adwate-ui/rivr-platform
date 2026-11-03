import type { BONUS_CHIPS_ON, Channels, Eligibility, Limits, PromotionTerms, Reward } from '@rivr/contracts/promotionModel';
import { t } from '@rivr/i18n';

/** A reward's kind, as the builder's first section offers them. */
export type RewardKind = Reward['kind'];

export const REWARD_KINDS: readonly RewardKind[] = [
  'points_multiplier', 'buyin_bonus', 'hours_bonus', 'bonus_chips', 'free_spin', 'cab_home', 'tournament_entry', 'waitlist_priority',
];

/** The builder's fields as typed (console v3): numbers stay text until the terms are read from them (formTerms). */
export interface BuilderForm {
  readonly name: string;
  readonly kind: RewardKind;
  readonly multiplier: string;
  readonly buyMode: 'percent' | 'fixed';
  readonly percent: string;
  readonly capChips: string;
  readonly buyChips: string;
  readonly firstN: string;
  /** An hours bonus's chips, or bonus chips on an event. */
  readonly chips: string;
  /** Hours played before an hours bonus or a free spin. */
  readonly afterHours: string;
  readonly bonusOn: (typeof BONUS_CHIPS_ON)[number];
  readonly spins: string;
  readonly fromVisit: string;
  readonly tournament: string;
  readonly stakes: 'all' | readonly string[];
  /** Tables a version already names: kept as they are, as the builder offers stakes only. */
  readonly tableIds: readonly string[] | undefined;
  readonly tiers: 'all' | readonly string[];
  readonly audience: Eligibility['audience'];
  readonly days: readonly number[];
  readonly from: string;
  readonly to: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly perMember: Limits['perMember'];
  readonly maxMembersPerDay: string;
  readonly budgetChips: string;
  /** The most grants a version already sets: kept as it is, as the builder does not offer it. */
  readonly maxGrants: number | undefined;
  readonly channels: Channels;
  readonly rulesText: string;
  readonly link: string;
}

export const EVERY_DAY: readonly number[] = [1, 2, 3, 4, 5, 6, 7];

// The club's whole day, 06:00 to 06:00 (decision 0438).
const ALL_DAY = { days: EVERY_DAY, from: '06:00', to: '06:00' } as const;

/** A blank promotion as the prototype starts one: 2× points on Friday and Saturday 20:00 to 02:00, once a visit, from `today`. */
export function blankForm(today: string): BuilderForm {
  return {
    name: '', kind: 'points_multiplier', multiplier: '2', buyMode: 'percent', percent: '20', capChips: '2000', buyChips: '1000', firstN: '5',
    chips: '1000', afterHours: '4', bonusOn: 'visit', spins: '1', fromVisit: '4', tournament: '', stakes: 'all', tableIds: undefined, tiers: 'all',
    audience: 'everyone', days: [5, 6], from: '20:00', to: '02:00', startsOn: today, endsOn: '', perMember: 'per_visit', maxMembersPerDay: '',
    budgetChips: '', maxGrants: undefined, channels: { playerApp: true, tv: true, website: false, whatsapp: false }, rulesText: '', link: '',
  };
}

const text = (value: number | undefined) => (value === undefined ? '' : String(value));
const hoursOf = (minutes: number) => String(minutes / 60);

function buyInFields(reward: Extract<Reward, { kind: 'buyin_bonus' }>): Partial<BuilderForm> {
  const firstN = text(reward.firstNBuyinsPerTable);
  if (reward.mode === 'fixed') return { buyMode: 'fixed', buyChips: String(reward.chips), firstN };
  return { buyMode: 'percent', percent: String(reward.percent), capChips: text(reward.capChips), firstN };
}

/** The fields of a reward, each kind its own. */
function rewardFields(reward: Reward): Partial<BuilderForm> {
  switch (reward.kind) {
    case 'points_multiplier':
      return { multiplier: String(reward.multiplier) };
    case 'buyin_bonus':
      return buyInFields(reward);
    case 'hours_bonus':
      return { chips: String(reward.chips), afterHours: hoursOf(reward.afterMinutes) };
    case 'bonus_chips':
      return { chips: String(reward.chips), bonusOn: reward.on };
    case 'free_spin':
      return { spins: String(reward.spins), afterHours: hoursOf(reward.afterMinutes) };
    case 'cab_home':
      return { fromVisit: String(reward.fromVisitInMonth) };
    case 'tournament_entry':
      return { tournament: reward.tournamentId };
    default:
      return {};
  }
}

/** A version's terms as the builder's fields, to change into a draft or to read in the approver's view. */
export function formFromTerms(terms: PromotionTerms): BuilderForm {
  const { eligibility, schedule, limits } = terms;
  return {
    ...blankForm(schedule.startsOn), ...rewardFields(terms.reward), kind: terms.reward.kind, name: terms.name,
    stakes: eligibility.stakes, tableIds: eligibility.tableIds, tiers: eligibility.tiers, audience: eligibility.audience,
    days: schedule.days, from: schedule.from, to: schedule.to, startsOn: schedule.startsOn, endsOn: schedule.endsOn ?? '',
    perMember: limits.perMember, maxMembersPerDay: text(limits.maxMembersPerDay), budgetChips: text(limits.budgetChips), maxGrants: limits.maxGrants,
    channels: terms.channels, rulesText: terms.rulesText.join('\n'), link: terms.link ?? '',
  };
}

/** The "Start from" templates (console v3 brief): Blank, then the club's seven. */
export const TEMPLATES = [
  'blank', 'double_points', 'buyin_bonus', 'four_hour_bonus', 'cab_home', 'spin_the_wheel', 'founders_priority', 'graduate_freeroll',
] as const;
export type TemplateKey = (typeof TEMPLATES)[number];

/** The tiers two templates are for, found among the venue's by name; null where the venue has none of that name. */
export interface TemplateTiers {
  readonly founders: string | null;
  readonly graduate: string | null;
}

const tierOnly = (tierId: string | null): BuilderForm['tiers'] => (tierId === null ? 'all' : [tierId]);

// What each template sets over a blank promotion; the club's own rules where step 2 converted them (decision 0461).
const TEMPLATE_FIELDS: Readonly<Record<Exclude<TemplateKey, 'blank'>, (tiers: TemplateTiers) => Partial<BuilderForm>>> = {
  double_points: () => ({ kind: 'points_multiplier', multiplier: '2' }),
  buyin_bonus: () => ({ kind: 'buyin_bonus', buyMode: 'percent', percent: '20', capChips: '2000', firstN: '5', ...ALL_DAY, days: [2], perMember: 'none' }),
  four_hour_bonus: () => ({ kind: 'hours_bonus', chips: '1000', afterHours: '4', ...ALL_DAY, perMember: 'per_day' }),
  cab_home: () => ({ kind: 'cab_home', fromVisit: '4', ...ALL_DAY, perMember: 'per_day' }),
  spin_the_wheel: () => ({ kind: 'free_spin', spins: '1', afterHours: '4', ...ALL_DAY, perMember: 'per_day' }),
  founders_priority: (tiers) => ({ kind: 'waitlist_priority', tiers: tierOnly(tiers.founders), ...ALL_DAY }),
  graduate_freeroll: (tiers) => ({
    kind: 'tournament_entry', tournament: t('console.promotions.builder.freerollTournament'), tiers: tierOnly(tiers.graduate), ...ALL_DAY, perMember: 'once',
  }),
};

/** The builder as a template fills it, named as the template names it, from `today`. */
export function templateForm(key: TemplateKey, today: string, tiers: TemplateTiers): BuilderForm {
  if (key === 'blank') return blankForm(today);
  return { ...blankForm(today), name: t(`console.promotions.builder.templateNames.${key}`), ...TEMPLATE_FIELDS[key](tiers) };
}

import type { BONUS_CHIPS_ON, Channels, Eligibility, HighHand, Limits, PromotionTerms, Reward } from '@rivr/contracts/promotionModel';
import { t } from '@rivr/i18n';

/** A reward's kind, as the builder's first section offers them. */
export type RewardKind = Reward['kind'];

export const REWARD_KINDS: readonly RewardKind[] = ['seat_bonus', 'hours_bonus', 'bonus_chips', 'waitlist_priority', 'high_hand'];

/** A high hand's listed hand, as typed: the hand and its Bonus. */
export interface HandFields {
  readonly hand: HighHand;
  readonly chips: string;
}

/** A play-time bonus step after the first, as typed: its hours played and its bonus chips. */
export interface HourStepFields {
  readonly afterHours: string;
  readonly chips: string;
}

/** A seat bonus tier, as typed (decision 0580): how many claims it covers and its bonus chips. */
export interface SeatTierFields {
  readonly count: string;
  readonly chips: string;
}

/** The builder's fields as typed (console v3): numbers stay text until the terms are read from them (formTerms). */
export interface BuilderForm {
  readonly name: string;
  readonly kind: RewardKind;
  /** A seat bonus for the first seats at each table; blank for a visit's first seat. */
  readonly firstN: string;
  /** A seat bonus of one amount (`chips`, `firstN`), or in tiers over the promotion's life, once a member (decision 0580). */
  readonly seatMode: 'fixed' | 'tiers';
  readonly seatTiers: readonly SeatTierFields[];
  /** An hours bonus's chips, or bonus chips on an event. */
  readonly chips: string;
  /** Hours played before an hours bonus; a play-time bonus's first step. */
  readonly afterHours: string;
  /** A play-time bonus pays at set times (its first step above, then `moreSteps`) or every so often (owner, 8 Nov). */
  readonly hoursMode: 'steps' | 'every';
  readonly moreSteps: readonly HourStepFields[];
  readonly everyHours: string;
  /** Up to how many times a visit every so often pays; blank is no cap. */
  readonly timesPerVisit: string;
  readonly bonusOn: (typeof BONUS_CHIPS_ON)[number];
  /** A high hand's hands, each with its Bonus, and its three rules (redesign RD-23). */
  readonly hands: readonly HandFields[];
  readonly bothHoleCards: boolean;
  readonly shownAtShowdown: boolean;
  readonly minPlayers: string;
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
  /** Up to how many times a member in the period (decision 0499); blank is once. */
  readonly timesPerMember: string;
  readonly maxMembersPerDay: string;
  readonly budgetChips: string;
  /** Whether the budget and the most grants are for the whole promotion or start again each month (decision 0499). */
  readonly budgetPeriod: 'whole' | 'month';
  /** The most grants a version already sets: kept as it is, as the builder does not offer it. */
  readonly maxGrants: number | undefined;
  readonly channels: Channels;
  readonly rulesText: string;
  readonly link: string;
}

export const EVERY_DAY: readonly number[] = [1, 2, 3, 4, 5, 6, 7];

// The club's whole day, 06:00 to 06:00 (decision 0472).
const ALL_DAY = { days: EVERY_DAY, from: '06:00', to: '06:00' } as const;

// What a high hand starts with: the three hands most clubs pay, to change, add to or remove.
const FIRST_HANDS: readonly HandFields[] = [
  { hand: 'royal_flush', chips: '25000' }, { hand: 'straight_flush', chips: '10000' }, { hand: 'four_of_a_kind', chips: '5000' },
];

/** A blank promotion: 1,000 bonus chips on a visit's first seat, on Friday and Saturday 20:00 to 02:00, once a visit, from `today`. */
export function blankForm(today: string): BuilderForm {
  return {
    name: '', kind: 'seat_bonus', firstN: '', seatMode: 'fixed', seatTiers: [{ count: '10', chips: '1000' }],
    chips: '1000', afterHours: '4', hoursMode: 'steps', moreSteps: [], everyHours: '2', timesPerVisit: '', bonusOn: 'visit', hands: FIRST_HANDS, bothHoleCards: true, shownAtShowdown: true, minPlayers: '4', stakes: 'all', tableIds: undefined, tiers: 'all',
    audience: 'everyone', days: [5, 6], from: '20:00', to: '02:00', startsOn: today, endsOn: '', perMember: 'per_visit', timesPerMember: '',
    maxMembersPerDay: '', budgetChips: '', budgetPeriod: 'whole', maxGrants: undefined, channels: { playerApp: true, tv: true, website: false, whatsapp: false }, rulesText: '', link: '',
  };
}

const text = (value: number | undefined) => (value === undefined ? '' : String(value));
const hoursOf = (minutes: number) => String(minutes / 60);

/** A play-time bonus's fields: its first step and those after it, or every so often (owner, 8 Nov). */
function hoursFields(reward: Extract<Reward, { kind: 'hours_bonus' }>): Partial<BuilderForm> {
  if (!('mode' in reward)) return { hoursMode: 'steps', chips: String(reward.chips), afterHours: hoursOf(reward.afterMinutes), moreSteps: [] };
  if (reward.mode === 'every') {
    return { hoursMode: 'every', chips: String(reward.chips), everyHours: hoursOf(reward.everyMinutes), timesPerVisit: text(reward.timesPerVisit) };
  }
  const [first, ...rest] = reward.steps.map((step) => ({ afterHours: hoursOf(step.afterMinutes), chips: String(step.chips) }));
  return { hoursMode: 'steps', ...(first === undefined ? {} : first), moreSteps: rest };
}

/** The fields of a reward, each kind its own. */
function rewardFields(reward: Reward): Partial<BuilderForm> {
  switch (reward.kind) {
    case 'seat_bonus':
      return 'tiers' in reward
        ? { seatMode: 'tiers', seatTiers: reward.tiers.map((tier) => ({ count: String(tier.count), chips: String(tier.chips) })) }
        : { seatMode: 'fixed', chips: String(reward.chips), firstN: text(reward.firstNSeatsPerTable) };
    case 'hours_bonus':
      return hoursFields(reward);
    case 'bonus_chips':
      return { chips: String(reward.chips), bonusOn: reward.on };
    case 'high_hand':
      return {
        hands: reward.hands.map((one) => ({ hand: one.hand, chips: String(one.chips) })), bothHoleCards: reward.rules.bothHoleCards,
        shownAtShowdown: reward.rules.shownAtShowdown, minPlayers: String(reward.rules.minPlayersDealt),
      };
    default:
      return {};
  }
}

/** A version's terms as the builder's fields, to change into a draft or to read in the approver's view. */
export function formFromTerms(terms: PromotionTerms): BuilderForm {
  const { eligibility, schedule, limits, reward } = terms;
  return {
    ...blankForm(schedule.startsOn), ...rewardFields(reward), kind: reward.kind, name: terms.name,
    stakes: eligibility.stakes, tableIds: eligibility.tableIds, tiers: eligibility.tiers, audience: eligibility.audience,
    days: schedule.days, from: schedule.from, to: schedule.to, startsOn: schedule.startsOn, endsOn: schedule.endsOn ?? '',
    perMember: limits.perMember, timesPerMember: text(limits.timesPerMember), maxMembersPerDay: text(limits.maxMembersPerDay),
    budgetChips: text(limits.budgetChips), budgetPeriod: limits.budgetPeriod === 'month' ? 'month' : 'whole', maxGrants: limits.maxGrants,
    channels: terms.channels, rulesText: terms.rulesText.join('\n'), link: terms.link ?? '',
  };
}

/** The "Start from" templates (console v3 brief): Blank, then the club's own. */
export const TEMPLATES = ['blank', 'seat_bonus', 'four_hour_bonus', 'founders_priority', 'high_hand'] as const;
export type TemplateKey = (typeof TEMPLATES)[number];

/** The tier a template is for, found among the venue's by name; null where the venue has none of that name. */
export interface TemplateTiers {
  readonly founders: string | null;
}

const tierOnly = (tierId: string | null): BuilderForm['tiers'] => (tierId === null ? 'all' : [tierId]);

// What each template sets over a blank promotion; the club's own rules where step 2 converted them (decision 0491).
const TEMPLATE_FIELDS: Readonly<Record<Exclude<TemplateKey, 'blank'>, (tiers: TemplateTiers) => Partial<BuilderForm>>> = {
  seat_bonus: () => ({ kind: 'seat_bonus', chips: '1000', firstN: '5', ...ALL_DAY, days: [2], perMember: 'per_day' }),
  four_hour_bonus: () => ({ kind: 'hours_bonus', chips: '1000', afterHours: '4', ...ALL_DAY, perMember: 'per_day' }),
  founders_priority: (tiers) => ({ kind: 'waitlist_priority', tiers: tierOnly(tiers.founders), ...ALL_DAY }),
  // Paid every time, held by its budget: 2,00,000 a month to start from.
  high_hand: () => ({ kind: 'high_hand', ...ALL_DAY, perMember: 'none', budgetChips: '200000', budgetPeriod: 'month' }),
};

/** The builder as a template fills it, named as the template names it, from `today`. */
export function templateForm(key: TemplateKey, today: string, tiers: TemplateTiers): BuilderForm {
  if (key === 'blank') return blankForm(today);
  return { ...blankForm(today), name: t(`console.promotions.builder.templateNames.${key}`), ...TEMPLATE_FIELDS[key](tiers) };
}

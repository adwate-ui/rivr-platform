import type { Eligibility, Limits, Reward, Schedule } from '@rivr/contracts/promotionModel';
import type { HoursBonus } from './hourSteps.ts';
import type { Terms } from './terms.ts';

/** The names to show for stake codes, tier ids, table ids and tournaments; an id with no name shows as it is. */
export interface PromotionNames {
  readonly stakes?: Readonly<Record<string, string>>;
  readonly tiers?: Readonly<Record<string, string>>;
  readonly tables?: Readonly<Record<string, string>>;
  readonly tournaments?: Readonly<Record<string, string>>;
}

const count = (value: number) => value.toLocaleString('en-IN');
const nameOf = (names: Readonly<Record<string, string>> | undefined, id: string) => names?.[id] ?? id;
/** Whole hours in words, and part hours as 1 h 30 min, never a decimal (audit F-055). */
function hours(minutes: number): string {
  const whole = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return `${whole} hour${whole === 1 ? '' : 's'}`;
  return whole === 0 ? `${rest} min` : `${whole} h ${rest} min`;
}
const BONUS_CHIPS_ON: Readonly<Record<Extract<Reward, { kind: 'bonus_chips' }>['on'], string>> = {
  visit: 'on each visit', first_buyin: 'on the first buy-in of a visit', referral: 'for each referral', signup: 'on sign-up',
};

function buyInText(reward: Extract<Reward, { kind: 'buyin_bonus' }>): string {
  const firstN = reward.firstNBuyinsPerTable === undefined ? '' : `, first ${reward.firstNBuyinsPerTable} buy-ins per table`;
  if (reward.mode === 'fixed') return `${count(reward.chips)} bonus chips on a buy-in${firstN}`;
  const cap = reward.capChips === undefined ? '' : `, up to ${count(reward.capChips)}`;
  return `${reward.percent}% buy-in bonus${cap}${firstN}`;
}

/** A seat bonus in words (owner, 8 Nov): on a visit's first seat, or for the first N seated at a table. */
function seatText(reward: Extract<Reward, { kind: 'seat_bonus' }>): string {
  return reward.firstNSeatsPerTable === undefined
    ? `${count(reward.chips)} bonus chips on the first seat of a visit`
    : `${count(reward.chips)} bonus chips for the first ${reward.firstNSeatsPerTable} seated at a table`;
}

/**
 * A play-time bonus in words (owner, 8 Nov): `1,000 bonus chips after 4 hours`; `500 bonus chips after 2 hours, then 1,000
 * after 4 hours`; `500 bonus chips every 2 hours, up to 3 times a visit`.
 */
function hoursText(reward: HoursBonus): string {
  if (!('mode' in reward)) return `${count(reward.chips)} bonus chips after ${hours(reward.afterMinutes)}`;
  if (reward.mode === 'steps') {
    return reward.steps.map((step, at) => `${at === 0 ? '' : 'then '}${count(step.chips)}${at === 0 ? ' bonus chips' : ''} after ${hours(step.afterMinutes)}`)
      .join(', ');
  }
  const times = reward.timesPerVisit;
  const cap = times === undefined ? '' : `, up to ${times === 1 ? 'once' : `${times} times`} a visit`;
  return `${count(reward.chips)} bonus chips every ${reward.everyMinutes === 60 ? 'hour' : hours(reward.everyMinutes)}${cap}`;
}

function rewardText(reward: Reward, names: PromotionNames): string {
  switch (reward.kind) {
    case 'points_multiplier':
      return `${reward.multiplier}× points`;
    case 'buyin_bonus':
      return buyInText(reward);
    case 'seat_bonus':
      return seatText(reward);
    case 'hours_bonus':
      return hoursText(reward);
    case 'bonus_chips':
      return `${count(reward.chips)} bonus chips ${BONUS_CHIPS_ON[reward.on]}`;
    case 'free_spin':
      return `${reward.spins} free spin${reward.spins === 1 ? '' : 's'} after ${hours(reward.afterMinutes)}`;
    case 'cab_home':
      return `A cab home from visit ${reward.fromVisitInMonth} in a month`;
    case 'tournament_entry':
      return `An entry to ${nameOf(names.tournaments, reward.tournamentId)}`;
    default:
      return 'Front of every waitlist';
  }
}

const AUDIENCE: Readonly<Record<Eligibility['audience'], string | null>> = {
  everyone: null, new_30d: 'new members, first 30 days', lapsed: 'lapsed regulars',
};

function whoText(eligibility: Eligibility, names: PromotionNames): string {
  const stakes = eligibility.stakes === 'all' ? 'all stakes' : eligibility.stakes.map((code) => nameOf(names.stakes, code)).join(', ');
  const tables = eligibility.tableIds?.map((id) => nameOf(names.tables, id)).join(', ') ?? null;
  const tiers = eligibility.tiers === 'all' ? null : eligibility.tiers.map((id) => nameOf(names.tiers, id)).join(', ');
  return [stakes, tables, tiers, AUDIENCE[eligibility.audience]].filter((part) => part !== null).join(' · ');
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function whenText(schedule: Schedule): string {
  const days = schedule.days.length === 7 ? 'every day' : [...schedule.days].sort((one, other) => one - other).map((day) => WEEKDAYS[day - 1]).join(', ');
  if (schedule.from !== schedule.to) return `${days} ${schedule.from}–${schedule.to}`;
  return schedule.from === '06:00' ? `${days}, all day` : `${days}, 24 hours from ${schedule.from}`;
}

/** Who a promotion is for and when it runs, each on its own, for the console's list: "NLH 100/200" and "Fri, Sat 20:00–02:00". */
export function whoAndWhen(promo: Pick<Terms, 'eligibility' | 'schedule'>, names: PromotionNames = {}): { readonly who: string; readonly when: string } {
  return { who: whoText(promo.eligibility, names), when: whenText(promo.schedule) };
}

const PER_MEMBER: Readonly<Record<Limits['perMember'], string>> = {
  none: 'No limit per member', per_visit: 'Once per visit per member', per_day: 'Once a day per member', per_week: 'Once a week per member',
  once: 'Once ever per member',
};

// Up to N times a member in a period (decision 0499): its period in words.
const TIMES_IN: Readonly<Record<Exclude<Limits['perMember'], 'none'>, string>> = {
  per_visit: 'per visit', per_day: 'a day', per_week: 'a week', once: 'ever',
};

function perMemberText(limits: Limits): string {
  const times = limits.timesPerMember;
  if (times === undefined || limits.perMember === 'none') return PER_MEMBER[limits.perMember];
  return `Up to ${count(times)} times ${TIMES_IN[limits.perMember]} per member`;
}

function limitsText(limits: Limits): string {
  const monthly = limits.budgetPeriod === 'month' ? ' a month' : '';
  return [
    perMemberText(limits),
    limits.maxMembersPerDay === undefined ? null : `first ${count(limits.maxMembersPerDay)} members a day`,
    limits.maxGrants === undefined ? null : `at most ${count(limits.maxGrants)} times${monthly}`,
    limits.budgetChips === undefined ? null : `budget ${count(limits.budgetChips)} chips${monthly}`,
  ].filter((part) => part !== null).join(', ');
}

const dateText = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/**
 * The one-line summary the builder, the approver and the TV read (the brief's describe; English only, as the owner
 * dropped Hindi on 18 Oct): the reward, for whom, when, the limits and the dates, in bonus chips and points, never
 * rupees. "20% buy-in bonus, up to 2,000, first 5 buy-ins per table, for all stakes, Tue, all day. No limit per member,
 * budget 50,000 chips. Starts 17 Nov 2026, no end date."
 */
export function describePromotion(promo: Terms, names: PromotionNames = {}): string {
  const { schedule } = promo;
  const ends = schedule.endsOn === undefined ? 'no end date' : `ends ${dateText(schedule.endsOn)}`;
  return `${rewardText(promo.reward, names)}, for ${whoText(promo.eligibility, names)}, ${whenText(schedule)}. ${limitsText(promo.limits)}. `
    + `Starts ${dateText(schedule.startsOn)}, ${ends}.`;
}

// The room a card has for each line, as public.promotion holds them.
const CARD_DETAIL = 200;
const CARD_RUNS = 120;
const fit = (text: string, room: number) => (text.length <= room ? text : `${text.slice(0, room - 1)}…`);

/**
 * A card's two lines, saved with the version for Home, the TVs, the website and WhatsApp: what it gives, and for whom
 * and when. "20% buy-in bonus, up to 2,000" and "NLH 100/200 · Tue 20:00–02:00".
 */
export function cardWords(promo: Terms, names: PromotionNames = {}): { readonly detail: string; readonly runs: string } {
  return {
    detail: fit(rewardText(promo.reward, names), CARD_DETAIL),
    runs: fit(`${whoText(promo.eligibility, names)} · ${whenText(promo.schedule)}`, CARD_RUNS),
  };
}

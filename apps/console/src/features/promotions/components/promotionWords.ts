import type { Eligibility, Limits, Reward, Schedule } from '@rivr/contracts/promotionModel';
import type { Terms } from '@rivr/domain/promotions';
import { formatNumber as count, t } from '@rivr/i18n';

/** The names to show for stake codes, tier ids, table ids and tournaments; an id with no name shows as it is. */
export interface PromotionNames {
  readonly stakes?: Readonly<Record<string, string>>;
  readonly tiers?: Readonly<Record<string, string>>;
  readonly tables?: Readonly<Record<string, string>>;
  readonly tournaments?: Readonly<Record<string, string>>;
}

type HoursBonus = Extract<Reward, { kind: 'hours_bonus' }>;

const nameOf = (names: Readonly<Record<string, string>> | undefined, id: string) => names?.[id] ?? id;
const isPart = (part: string | null): part is string => part !== null;

/** Whole hours in words, and part hours as 1 h 30 min, never a decimal (audit F-055). */
function hours(minutes: number): string {
  const whole = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return whole === 1 ? t('console.promotions.words.time.hour') : t('console.promotions.words.time.hours', { count: whole });
  return whole === 0 ? t('console.promotions.words.time.minutes', { minutes: rest }) : t('console.promotions.words.time.hoursMinutes', { hours: whole, minutes: rest });
}

function buyInText(reward: Extract<Reward, { kind: 'buyin_bonus' }>): string {
  const firstN = reward.firstNBuyinsPerTable === undefined ? null : t('console.promotions.words.buyIn.firstN', { count: reward.firstNBuyinsPerTable });
  if (reward.mode === 'fixed') return [t('console.promotions.words.buyIn.fixed', { chips: count(reward.chips) }), firstN].filter(isPart).join(', ');
  const cap = reward.capChips === undefined ? null : t('console.promotions.words.buyIn.upTo', { chips: count(reward.capChips) });
  return [t('console.promotions.words.buyIn.percent', { percent: reward.percent }), cap, firstN].filter(isPart).join(', ');
}

/** A seat bonus in words (owner, 8 Nov): on a visit's first seat, or for the first N seated at a table. */
function seatText(reward: Extract<Reward, { kind: 'seat_bonus' }>): string {
  return reward.firstNSeatsPerTable === undefined
    ? t('console.promotions.words.seat.first', { chips: count(reward.chips) })
    : t('console.promotions.words.seat.firstN', { chips: count(reward.chips), count: reward.firstNSeatsPerTable });
}

/**
 * A play-time bonus in words (owner, 8 Nov): `1,000 bonus chips after 4 hours`; `500 bonus chips after 2 hours, then 1,000
 * after 4 hours`; `500 bonus chips every 2 hours, up to 3 times a visit`.
 */
function hoursText(reward: HoursBonus): string {
  if (!('mode' in reward)) return t('console.promotions.words.hoursBonus.after', { chips: count(reward.chips), time: hours(reward.afterMinutes) });
  if (reward.mode === 'steps') {
    return reward.steps.map((step, at) => t(at === 0 ? 'console.promotions.words.hoursBonus.after' : 'console.promotions.words.hoursBonus.thenAfter', {
      chips: count(step.chips), time: hours(step.afterMinutes),
    })).join(', ');
  }
  const times = reward.timesPerVisit;
  const every = reward.everyMinutes === 60
    ? t('console.promotions.words.hoursBonus.everyHour', { chips: count(reward.chips) })
    : t('console.promotions.words.hoursBonus.every', { chips: count(reward.chips), time: hours(reward.everyMinutes) });
  if (times === undefined) return every;
  return [every, times === 1 ? t('console.promotions.words.hoursBonus.upToOnce') : t('console.promotions.words.hoursBonus.upToTimes', { count: times })].join(', ');
}

function rewardText(reward: Reward, names: PromotionNames): string {
  switch (reward.kind) {
    case 'points_multiplier':
      return t('console.promotions.words.pointsMultiplier', { multiplier: reward.multiplier });
    case 'buyin_bonus':
      return buyInText(reward);
    case 'seat_bonus':
      return seatText(reward);
    case 'hours_bonus':
      return hoursText(reward);
    case 'bonus_chips':
      return t(`console.promotions.words.bonusChips.${reward.on}`, { chips: count(reward.chips) });
    case 'free_spin':
      return reward.spins === 1
        ? t('console.promotions.words.freeSpin', { time: hours(reward.afterMinutes) })
        : t('console.promotions.words.freeSpins', { count: reward.spins, time: hours(reward.afterMinutes) });
    case 'cab_home':
      return t('console.promotions.words.cabHome', { visit: reward.fromVisitInMonth });
    case 'tournament_entry':
      return t('console.promotions.words.tournamentEntry', { name: nameOf(names.tournaments, reward.tournamentId) });
    default:
      return t('console.promotions.words.priority');
  }
}

function whoText(eligibility: Eligibility, names: PromotionNames): string {
  const stakes = eligibility.stakes === 'all' ? t('console.promotions.words.allStakes') : eligibility.stakes.map((code) => nameOf(names.stakes, code)).join(', ');
  const tables = eligibility.tableIds?.map((id) => nameOf(names.tables, id)).join(', ') ?? null;
  const tiers = eligibility.tiers === 'all' ? null : eligibility.tiers.map((id) => nameOf(names.tiers, id)).join(', ');
  const audience = eligibility.audience === 'everyone' ? null : t(`console.promotions.words.audience.${eligibility.audience}`);
  return [stakes, tables, tiers, audience].filter(isPart).join(' · ');
}

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

function whenText(schedule: Schedule): string {
  const days = schedule.days.length === 7
    ? t('console.promotions.words.everyDay')
    : WEEKDAYS.filter((_, at) => schedule.days.includes(at + 1)).map((day) => t(`console.promotions.words.days.${day}`)).join(', ');
  if (schedule.from !== schedule.to) return t('console.promotions.words.window', { days, from: schedule.from, to: schedule.to });
  return schedule.from === '06:00' ? t('console.promotions.words.allDay', { days }) : t('console.promotions.words.fromHour', { days, from: schedule.from });
}

/** Who a promotion is for and when it runs, each on its own, for the console's list: "NLH 100/200" and "Fri, Sat 20:00–02:00". */
export function whoAndWhen(promo: Pick<Terms, 'eligibility' | 'schedule'>, names: PromotionNames = {}): { readonly who: string; readonly when: string } {
  return { who: whoText(promo.eligibility, names), when: whenText(promo.schedule) };
}

function perMemberText(limits: Limits): string {
  const times = limits.timesPerMember;
  const { perMember } = limits;
  if (times === undefined || perMember === 'none') return t(`console.promotions.words.perMember.${perMember}`);
  return t(`console.promotions.words.timesPerMember.${perMember}`, { count: count(times) });
}

function limitsText(limits: Limits): string {
  const isMonthly = limits.budgetPeriod === 'month';
  return [
    perMemberText(limits),
    limits.maxMembersPerDay === undefined ? null : t('console.promotions.words.firstMembers', { count: count(limits.maxMembersPerDay) }),
    limits.maxGrants === undefined ? null : t(isMonthly ? 'console.promotions.words.atMostMonth' : 'console.promotions.words.atMost', { count: count(limits.maxGrants) }),
    limits.budgetChips === undefined ? null : t(isMonthly ? 'console.promotions.words.budgetMonth' : 'console.promotions.words.budget', { count: count(limits.budgetChips) }),
  ].filter(isPart).join(', ');
}

const dateText = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/**
 * The one-line summary the builder and the approver read, in bonus chips and points, never rupees: "500 bonus chips on the
 * first seat of a visit, for all stakes, Tue, all day. No limit per member, budget 50,000 chips. Starts 17 Nov 2026, no end
 * date."
 */
export function describePromotion(promo: Terms, names: PromotionNames = {}): string {
  const { schedule } = promo;
  return t('console.promotions.words.line', {
    reward: rewardText(promo.reward, names), who: whoText(promo.eligibility, names), when: whenText(schedule), limits: limitsText(promo.limits),
    starts: dateText(schedule.startsOn),
    ends: schedule.endsOn === undefined ? t('console.promotions.words.noEnd') : t('console.promotions.words.ends', { date: dateText(schedule.endsOn) }),
  });
}

// The room a card has for each line, as public.promotion holds them.
const CARD_DETAIL = 200;
const CARD_RUNS = 120;
const fit = (text: string, room: number) => (text.length <= room ? text : `${text.slice(0, room - 1)}…`);

/**
 * A card's two lines, saved with the version for Home, the TVs, the website and WhatsApp: what it gives, and for whom
 * and when. "20% of your buy-in in bonus chips, up to 2,000 bonus chips" and "NLH 100/200 · Tue 20:00–02:00".
 */
export function cardWords(promo: Terms, names: PromotionNames = {}): { readonly detail: string; readonly runs: string } {
  return {
    detail: fit(rewardText(promo.reward, names), CARD_DETAIL),
    runs: fit(`${whoText(promo.eligibility, names)} · ${whenText(promo.schedule)}`, CARD_RUNS),
  };
}

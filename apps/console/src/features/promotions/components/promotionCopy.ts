import type { PromotionBuilder } from '@rivr/contracts';
import type { PromotionStake } from '@rivr/db';
import { formatChips, formatList, t } from '@rivr/i18n';

/** The days of the week in ISO order: Monday is day 1. */
export const WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

/** A day of the week by its ISO number, as the builder's chips and cards name it: 4 is "Thursday". */
export function dayName(day: number): string {
  const key = WEEK[day - 1];
  return key === undefined ? '' : t(`console.promotions.dayNames.${key}`);
}

/** A stake as the builder's Who block names it: its table type, "NLH 100/200". */
export function stakeLabel(stake: PromotionStake): string {
  return stake.name;
}

function daysText(days: readonly number[]): string {
  if (days.length === 0 || days.length === WEEK.length) return t('console.promotions.everyDay');
  return formatList([...days].sort((a, b) => a - b).map(dayName));
}

/**
 * Who and when, as the cards say it under the title (#84): "NLH 100/200 · Thursday, 14:00 to 20:00", or
 * "All stakes · Every day" when nothing is chosen; a limit follows, as players must know it: "· Once per
 * member". Published with the promotion.
 */
export function runsText(choices: PromotionBuilder, stakes: readonly PromotionStake[]): string {
  const stake = stakes.find((one) => one.code === choices.stake);
  const who = stake === undefined ? t('console.promotions.allStakes') : stakeLabel(stake);
  const days = daysText(choices.days);
  const when = choices.from === null || choices.until === null ? days : t('console.promotions.dayWindow', { days, from: choices.from, until: choices.until });
  if (choices.limit === 'none') return t('console.promotions.runs', { who, when });
  return t('console.promotions.runsWithLimit', { who, when, limit: t(`console.promotions.limitOptions.${choices.limit}`) });
}

/**
 * What a bonus gives, on its card: "Up to 5,000 bonus chips a buy-in" (#415, #629), or "1,000 bonus chips after 4 hours at
 * the tables" (#646); the points rewards need none. A figure half typed or mistyped (2500.50, ₹5000) gives none until it is
 * whole, rather than throwing (F2-03); Publish says what to fix.
 */
export function rewardDetail(choices: PromotionBuilder): string | undefined {
  if (choices.reward === 'buy_in_bonus') {
    if (!Number.isSafeInteger(choices.bonus_cap_rupees)) return undefined;
    return t('console.promotions.bonusDetail', { cap: formatChips(BigInt(choices.bonus_cap_rupees) * 100n) });
  }
  if (choices.reward === 'hours_bonus') {
    if (!Number.isSafeInteger(choices.bonus_chips)) return undefined;
    const chips = formatChips(BigInt(choices.bonus_chips) * 100n);
    return choices.bonus_hours === 1
      ? t('console.promotions.hoursBonusDetailOne', { chips })
      : t('console.promotions.hoursBonusDetail', { chips, hours: String(choices.bonus_hours) });
  }
  return undefined;
}

/** The promotion's name: what it gives, "Double points". */
export function rewardTitle(choices: PromotionBuilder): string {
  return t(`console.promotions.rewards.${choices.reward}`);
}

import type { PromotionConditions, PromotionEffect, PromotionRules } from '@rivr/contracts';
import type { PromotionAwaitingApproval, PromotionStake } from '@rivr/db';
import { formatChips, formatList, formatNumber, t } from '@rivr/i18n';
import { dayName } from './promotionCopy.ts';

// A bonus is bonus chips, never rupees (#629).
const chips = (paise: number) => formatChips(BigInt(paise));

function bonusText(effect: Extract<PromotionEffect, { kind: 'bonus' }>): string {
  if ('amount_paise' in effect) return t('console.promotions.rule.gives.bonusAmount', { chips: chips(effect.amount_paise), days: effect.expires_days });
  const percent = formatNumber(effect.percent_bps / 100);
  return effect.cap_paise === undefined
    ? t('console.promotions.rule.gives.bonusShare', { percent, days: effect.expires_days })
    : t('console.promotions.rule.gives.bonusShareCapped', { percent, cap: chips(effect.cap_paise), days: effect.expires_days });
}

function pointsText(effect: Extract<PromotionEffect, { kind: 'points' }>): string {
  return 'points' in effect
    ? t('console.promotions.rule.gives.points', { points: formatNumber(effect.points) })
    : t('console.promotions.rule.gives.pointsMultiplier', { multiplier: formatNumber(effect.multiplier_percent / 100) });
}

/**
 * What a rule gives, in the approver's words: the amounts as stored, not as the submitter described them. No rupees, as
 * on every console (decision 0284, #649): a prize is named without its worth, a jackpot payout without its amount.
 */
function givesText(effect: PromotionEffect): string {
  switch (effect.kind) {
    case 'bonus': return bonusText(effect);
    case 'points': return pointsText(effect);
    case 'freeroll_ticket': return t('console.promotions.rule.gives.freerollTicket', { tournament: effect.tournament });
    case 'cab_eligibility': return t('console.promotions.rule.gives.cab');
    case 'physical_prize': return t('console.promotions.rule.gives.prize', { prize: effect.prize });
    case 'jackpot_payout': return t('console.promotions.rule.gives.jackpot', { pool: t(`console.promotions.rule.pools.${effect.pool}`) });
    case 'message': return t('console.promotions.rule.gives.message', { text: effect.text });
    case 'spin': return t('console.promotions.rule.gives.spin');
  }
}

const present = (text: string | false | undefined): text is string => typeof text === 'string';

/** When a rule applies: its days, window, first so many, and the play it waits for. */
function whenTexts(conditions: PromotionConditions): string[] {
  const { days, from, until, first_n: first } = conditions;
  return [
    days !== undefined && t('console.promotions.rule.conditions.days', { days: formatList([...days].sort((a, b) => a - b).map(dayName)) }),
    from !== undefined && until !== undefined && t('console.promotions.rule.conditions.window', { from, until }),
    first !== undefined && t(`console.promotions.rule.conditions.${first.per === 'table' ? 'firstPerTable' : 'firstPerDay'}`, { count: first.count }),
    conditions.call_time_complete === true && t('console.promotions.rule.conditions.callTime'),
    conditions.min_hours !== undefined && (conditions.min_hours === 1
      ? t('console.promotions.rule.conditions.minHoursOne')
      : t('console.promotions.rule.conditions.minHours', { hours: conditions.min_hours })),
  ].filter(present);
}

/** The tables or the tiers a rule is for, by how many: one in the singular. */
function chosenText(ids: readonly string[] | undefined, kind: 'tables' | 'tiers'): string | false {
  if (ids === undefined) return false;
  return ids.length === 1 ? t(`console.promotions.rule.conditions.${kind}One`) : t(`console.promotions.rule.conditions.${kind}`, { count: ids.length });
}

/** Who a rule is for: its stakes, tables, tiers, new or returning players, regulars and hands. */
function whoTexts(conditions: PromotionConditions, stakes: readonly PromotionStake[]): string[] {
  const stakeName = (code: string) => stakes.find((stake) => stake.code === code)?.name ?? code;
  return [
    conditions.stakes !== undefined && t('console.promotions.rule.conditions.stakes', { stakes: formatList(conditions.stakes.map(stakeName)) }),
    chosenText(conditions.table_ids, 'tables'),
    chosenText(conditions.tier_ids, 'tiers'),
    conditions.new_player === true && t('console.promotions.rule.conditions.newPlayer'),
    conditions.lapsed_days !== undefined && t('console.promotions.rule.conditions.lapsed', { days: conditions.lapsed_days }),
    conditions.min_visits_in_month !== undefined && (conditions.min_visits_in_month === 1
      ? t('console.promotions.rule.conditions.minVisitsOne')
      : t('console.promotions.rule.conditions.minVisits', { count: conditions.min_visits_in_month })),
    conditions.hands !== undefined &&
      t('console.promotions.rule.conditions.hands', { hands: formatList(conditions.hands.map((hand) => t(`console.promotions.rule.hands.${hand}`))) }),
  ].filter(present);
}

/** One rule in two lines: when it sets off and what it gives, then for whom and when. */
function ruleLines(rule: PromotionRules[number], stakes: readonly PromotionStake[]): string[] {
  const conditions = [...whoTexts(rule.conditions, stakes), ...whenTexts(rule.conditions)];
  return [
    t('console.promotions.rule.line', { when: t(`console.promotions.rule.trigger.${rule.trigger}`), gives: givesText(rule.effect) }),
    t('console.promotions.rule.forWhom', { who: conditions.length === 0 ? t('console.promotions.rule.everyone') : conditions.join(' · ') }),
  ];
}

function limitText(perPlayer: PromotionAwaitingApproval['perPlayer']): string {
  if (perPlayer === null) return t('console.promotions.rule.noLimit');
  return t(perPlayer.period === 'day' ? 'console.promotions.rule.limitPerDay' : 'console.promotions.rule.limitInAll', { limit: perPlayer.limit });
}

function capText({ paise, count }: PromotionAwaitingApproval['budget']): string {
  if (paise !== null && count !== null) {
    return count === 1 ? t('console.promotions.rule.budgetBothOne', { amount: formatChips(paise) }) : t('console.promotions.rule.budgetBoth', { amount: formatChips(paise), count });
  }
  if (paise !== null) return t('console.promotions.rule.budgetPaise', { amount: formatChips(paise) });
  if (count === null) return t('console.promotions.rule.noBudget');
  return count === 1 ? t('console.promotions.rule.budgetCountOne') : t('console.promotions.rule.budgetCount', { count });
}

/** The budget in words, and that it is each month's when it is (#562). */
function budgetText(budget: PromotionAwaitingApproval['budget']): string {
  const cap = capText(budget);
  const hasCap = budget.paise !== null || budget.count !== null;
  return hasCap && budget.period === 'month' ? t('console.promotions.rule.eachMonth', { budget: cap }) : cap;
}

/**
 * What a waiting promotion actually does, in words made from its stored rules, limit and budget (#144): the approver
 * reads these, since nothing ties the card words the submitter typed to the rule. Null when its rules cannot be read.
 */
export function approvalLines(promotion: PromotionAwaitingApproval, stakes: readonly PromotionStake[]): string[] | null {
  if (promotion.rules === null) return null;
  const does = promotion.rules.length === 0 ? [t('console.promotions.rule.cardOnly')] : promotion.rules.flatMap((rule) => ruleLines(rule, stakes));
  return [...does, limitText(promotion.perPlayer), budgetText(promotion.budget)];
}

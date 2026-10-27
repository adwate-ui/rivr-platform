import type { PromotionConditions, PromotionEffect, PromotionRules } from '@rivr/contracts';
import type { PromotionAwaitingApproval, PromotionStake } from '@rivr/db';
import { formatList, formatMoney, formatNumber, t } from '@rivr/i18n';
import { dayName } from './promotionCopy.ts';

const money = (paise: number) => formatMoney(BigInt(paise));

function bonusText(effect: Extract<PromotionEffect, { kind: 'bonus' }>): string {
  if ('amount_paise' in effect) return t('console.promotions.rule.gives.bonusAmount', { amount: money(effect.amount_paise), days: effect.expires_days });
  const percent = formatNumber(effect.percent_bps / 100);
  return effect.cap_paise === undefined
    ? t('console.promotions.rule.gives.bonusShare', { percent, days: effect.expires_days })
    : t('console.promotions.rule.gives.bonusShareCapped', { percent, cap: money(effect.cap_paise), days: effect.expires_days });
}

function pointsText(effect: Extract<PromotionEffect, { kind: 'points' }>): string {
  return 'points' in effect
    ? t('console.promotions.rule.gives.points', { points: formatNumber(effect.points) })
    : t('console.promotions.rule.gives.pointsMultiplier', { multiplier: formatNumber(effect.multiplier_percent / 100) });
}

function prizeText(effect: Extract<PromotionEffect, { kind: 'physical_prize' }>): string {
  return effect.value_paise === undefined
    ? t('console.promotions.rule.gives.prize', { prize: effect.prize })
    : t('console.promotions.rule.gives.prizeWorth', { prize: effect.prize, value: money(effect.value_paise) });
}

/** What a rule gives, in the approver's words: the amounts as stored, not as the submitter described them. */
function givesText(effect: PromotionEffect): string {
  switch (effect.kind) {
    case 'bonus': return bonusText(effect);
    case 'points': return pointsText(effect);
    case 'freeroll_ticket': return t('console.promotions.rule.gives.freerollTicket', { tournament: effect.tournament });
    case 'cab_eligibility': return t('console.promotions.rule.gives.cab');
    case 'physical_prize': return prizeText(effect);
    case 'jackpot_payout':
      return t('console.promotions.rule.gives.jackpot', { amount: money(effect.amount_paise), pool: t(`console.promotions.rule.pools.${effect.pool}`) });
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
    conditions.min_hours !== undefined && t('console.promotions.rule.conditions.minHours', { hours: conditions.min_hours }),
  ].filter(present);
}

/** Who a rule is for: its stakes, tables, tiers, new or returning players, regulars and hands. */
function whoTexts(conditions: PromotionConditions, stakes: readonly PromotionStake[]): string[] {
  const stakeName = (code: string) => stakes.find((stake) => stake.code === code)?.name ?? code;
  return [
    conditions.stakes !== undefined && t('console.promotions.rule.conditions.stakes', { stakes: formatList(conditions.stakes.map(stakeName)) }),
    conditions.table_ids !== undefined && t('console.promotions.rule.conditions.tables', { count: conditions.table_ids.length }),
    conditions.tier_ids !== undefined && t('console.promotions.rule.conditions.tiers', { count: conditions.tier_ids.length }),
    conditions.new_player === true && t('console.promotions.rule.conditions.newPlayer'),
    conditions.lapsed_days !== undefined && t('console.promotions.rule.conditions.lapsed', { days: conditions.lapsed_days }),
    conditions.min_visits_in_month !== undefined && t('console.promotions.rule.conditions.minVisits', { count: conditions.min_visits_in_month }),
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
  if (paise !== null && count !== null) return t('console.promotions.rule.budgetBoth', { amount: formatMoney(paise), count });
  if (paise !== null) return t('console.promotions.rule.budgetPaise', { amount: formatMoney(paise) });
  return count === null ? t('console.promotions.rule.noBudget') : t('console.promotions.rule.budgetCount', { count });
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

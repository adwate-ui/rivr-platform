import type { JackpotEvent, JackpotFailure } from '@rivr/db';
import type { BadBeatPayout, PayoutRule } from '@rivr/domain/jackpot';
import { formatDate, formatMoney, formatNumber, formatTime, t, type MessageKey } from '@rivr/i18n';

const FAILURE_COPY: Readonly<Record<JackpotFailure, MessageKey>> = {
  not_allowed: 'console.jackpots.notAllowedAction',
  not_member: 'console.jackpots.notMember',
  invalid: 'console.jackpots.refused',
  paused: 'console.jackpots.paused',
  switched_off: 'console.jackpots.switchedOff',
  already_reversed: 'console.jackpots.alreadyReversed',
  unavailable: 'console.jackpots.unavailable',
};

const percent = (basisPoints: bigint) => formatNumber(Number(basisPoints) / 100);

/** The payout rule in words: what share of the jackpot a bad beat pays, and to whom. */
export function ruleText(rule: PayoutRule): string {
  return t('console.jackpots.rule', { pool: percent(rule.poolShare), loser: percent(rule.loser), winner: percent(rule.winner), table: percent(rule.table) });
}

/** What a payout comes to, before it is paid. */
export function previewText(payout: BadBeatPayout, others: number): string {
  const amounts = { loser: formatMoney(payout.loser), winner: formatMoney(payout.winner) };
  return others === 0
    ? t('console.jackpots.previewNoOthers', amounts)
    : t('console.jackpots.preview', { ...amounts, each: formatMoney(payout.eachAtTable), count: others });
}

/** When a payout or reversal was made: the date and the IST time. */
export function whenText(event: JackpotEvent): string {
  const at = new Date(event.createdAt);
  return `${formatDate(at)}, ${formatTime(at)}`;
}

/** A payout or a reversal as the history lists it. */
export function eventText(event: JackpotEvent): string {
  if (event.kind === 'reversal') {
    return t('console.jackpots.reversedLine', { when: whenText(event), reason: event.reason ?? '', total: formatMoney(event.total) });
  }
  return t('console.jackpots.paidLine', {
    when: whenText(event), table: event.tableName ?? '', loser: event.loserName ?? '', winner: event.winnerName ?? '', total: formatMoney(event.total),
  });
}

/** Why a payout or a reversal did not go through. */
export function jackpotFailureText(failure: JackpotFailure): string {
  return t(FAILURE_COPY[failure]);
}

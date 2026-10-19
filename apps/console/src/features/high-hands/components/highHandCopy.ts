import { HIGH_HAND_RANKS } from '@rivr/contracts';
import type { HighHand, HighHandFailure } from '@rivr/db';
import { formatMoney, formatTime, t, type MessageKey } from '@rivr/i18n';

/** What the High hands screen says when approving or rejecting did not go through. */
export const HIGH_HAND_FAILURE_COPY: Readonly<Record<HighHandFailure, MessageKey>> = {
  not_allowed: 'console.highHands.notAllowedAction',
  decided: 'console.highHands.decided',
  changed: 'console.highHands.changed',
  paused: 'console.highHands.paused',
  switched_off: 'console.highHands.switchedOff',
  invalid: 'console.highHands.invalid',
  unavailable: 'console.highHands.unavailable',
};

/** A claim in one line: the hand (with the rank of a four of a kind), the seat, the table, when, and the dealer. */
export function claimText(hand: HighHand): string {
  const known = HIGH_HAND_RANKS.find((rank) => rank === hand.rank);
  const rank = known === undefined ? '' : ` ${t(`tv.ranks.${known}`)}`;
  return t('console.highHands.claim', {
    category: `${t(`tv.highHand.${hand.category}`)}${rank}`, seat: hand.seat, table: hand.tableName,
    time: formatTime(new Date(hand.playedAt)), dealer: hand.dealerName,
  });
}

/** What a decided claim says: paid and by whom, or rejected, by whom and why. */
export function decisionText(hand: HighHand): string {
  if (hand.status === 'approved' && hand.payout !== null) {
    return t('console.highHands.approvedBy', { amount: formatMoney(hand.payout), name: hand.decidedByName ?? '' });
  }
  return t('console.highHands.rejectedBy', { name: hand.decidedByName ?? '', reason: hand.reason ?? '' });
}

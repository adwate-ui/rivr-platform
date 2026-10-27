import { HIGH_HAND_RANKS } from '@rivr/contracts';
import type { HighHand, HighHandFailure } from '@rivr/db';
import { formatDate, formatMoney, formatTime, t, type MessageKey } from '@rivr/i18n';

/** What the High hands screen says when approving or rejecting did not go through. */
export const HIGH_HAND_FAILURE_COPY: Readonly<Record<HighHandFailure, MessageKey>> = {
  not_allowed: 'console.highHands.notAllowedAction',
  decided: 'console.highHands.decided',
  changed: 'console.highHands.changed',
  no_seat: 'console.highHands.noSeat',
  paused: 'console.highHands.paused',
  switched_off: 'console.highHands.switchedOff',
  invalid: 'console.highHands.invalid',
  unavailable: 'console.highHands.unavailable',
};

/** A hand's name, with the rank of a four of a kind: `Four of a kind Queens`. */
function handName(category: HighHand['category'], rank: string | null): string {
  const known = HIGH_HAND_RANKS.find((candidate) => candidate === rank);
  return `${t(`tv.highHand.${category}`)}${known === undefined ? '' : ` ${t(`tv.ranks.${known}`)}`}`;
}

/** A waiting claim as the console's prompt says it (#317): `High hand claim · Table 3, seat 4 · Straight flush · ₹10,000`. */
export function promptText(hand: HighHand): string {
  const parts = { table: hand.tableName, seat: hand.seat, category: handName(hand.category, hand.rank) };
  return hand.payout === null
    ? t('console.highHands.promptPaysNothing', parts)
    : t('console.highHands.prompt', { ...parts, amount: formatMoney(hand.payout) });
}

/** A claim in one line: the hand (with the rank of a four of a kind), the seat, the table, the day and time, and the dealer. */
export function claimText(hand: HighHand): string {
  return t('console.highHands.claim', {
    category: handName(hand.category, hand.rank), seat: hand.seat, table: hand.tableName,
    time: `${formatDate(new Date(hand.playedAt))}, ${formatTime(new Date(hand.playedAt))}`, dealer: hand.dealerName,
  });
}

/** What the dealer claimed before the floor corrected it (#324), and who corrected it. */
export function correctionText(hand: HighHand): string {
  if (hand.original === null) return '';
  return t('console.highHands.correctedBy', {
    name: hand.original.byName, category: handName(hand.original.category, hand.original.rank), seat: hand.original.seat,
  });
}

/**
 * What a decided claim says: paid and by whom, or rejected, by whom and why. A reversed claim keeps what
 * was paid, or why it was rejected, so it says the same; its reversal is a line of its own.
 */
export function decisionText(hand: HighHand): string {
  if (hand.reason === null && hand.payout !== null) {
    return t('console.highHands.approvedBy', { amount: formatMoney(hand.payout), name: hand.decidedByName ?? '' });
  }
  return t('console.highHands.rejectedBy', { name: hand.decidedByName ?? '', reason: hand.reason ?? '' });
}

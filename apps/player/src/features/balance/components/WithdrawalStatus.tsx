import { useWithdrawals, type Withdrawal } from '@rivr/db';
import { formatMoney, t } from '@rivr/i18n';
import { Text } from '@rivr/ui';
import { useState } from 'react';

// A decided withdrawal stays on Balance for a week; after that its movement says enough.
const SHOWN_FOR_MS = 7 * 24 * 60 * 60 * 1000;

/** The withdrawal in words: pending to which bank, sent with its UTR, or declined and returned. */
function lineOf(withdrawal: Withdrawal): string {
  const amount = formatMoney(withdrawal.amount);
  if (withdrawal.status === 'waiting') return t('player.balance.withdrawalPending', { amount, bank: withdrawal.bankName });
  if (withdrawal.status === 'sent') return t('player.balance.withdrawalSent', { utr: withdrawal.utr ?? '' });
  return t('player.balance.withdrawalDeclined', { reason: withdrawal.declineReason ?? '', amount });
}

/**
 * The member's latest withdrawal on Balance (#21; design prompt flow 9): "Withdrawal pending ·
 * ₹1,00,000 to HDFC Bank" while the cage has it, then "Withdrawal sent. UTR 412908771204." for a week.
 * Nothing when there is none to show.
 */
export function WithdrawalStatus() {
  const withdrawals = useWithdrawals();
  // When Balance opened: a withdrawal decided a week before then is no longer shown.
  const [openedAt] = useState(() => Date.now());
  const latest = withdrawals.data?.[0];
  if (latest === undefined) return null;
  const isRecent = latest.decidedAt === null || openedAt - new Date(latest.decidedAt).getTime() < SHOWN_FOR_MS;
  return isRecent ? <Text tone={latest.status === 'sent' ? 'money' : 'default'}>{lineOf(latest)}</Text> : null;
}

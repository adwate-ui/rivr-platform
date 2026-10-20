import { useDeposits, type Deposit } from '@rivr/db';
import { formatMoney, t } from '@rivr/i18n';
import { Text } from '@rivr/ui';
import { useState } from 'react';

// A decided deposit stays on Balance for a week, as a withdrawal does; after that its movement says enough.
const SHOWN_FOR_MS = 7 * 24 * 60 * 60 * 1000;

/** The deposit in words, as the prototype says it: submitted, received into cash, or not found against its UTR. */
function lineOf(deposit: Deposit): string {
  if (deposit.status === 'waiting') return t('player.balance.depositSubmitted');
  if (deposit.status === 'received') return t('player.balance.depositReceived', { amount: formatMoney(deposit.amount) });
  return t('player.balance.depositNotFound', { utr: deposit.utr });
}

/** The member's latest deposit on Balance (#29). Nothing when there is none to show. */
export function DepositStatus() {
  const deposits = useDeposits();
  // When Balance opened: a deposit decided a week before then is no longer shown.
  const [openedAt] = useState(() => Date.now());
  const latest = deposits.data?.[0];
  if (latest === undefined) return null;
  const isRecent = latest.decidedAt === null || openedAt - new Date(latest.decidedAt).getTime() < SHOWN_FOR_MS;
  return isRecent ? <Text tone={latest.status === 'received' ? 'money' : 'default'}>{lineOf(latest)}</Text> : null;
}

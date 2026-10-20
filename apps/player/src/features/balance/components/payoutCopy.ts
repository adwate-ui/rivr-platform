import type { PayoutAccount, PayoutAccountFailure } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';

/** What the member is told when a payout account change is refused. */
export const PAYOUT_FAILURE_COPY: Readonly<Record<PayoutAccountFailure, MessageKey>> = {
  too_many: 'player.balance.payoutTooMany',
  already_added: 'player.balance.payoutAlreadyAdded',
  invalid: 'player.balance.payoutInvalid',
  not_allowed: 'player.balance.payoutNotAllowed',
  stopped: 'player.balance.payoutStopped',
  paused: 'player.balance.payoutPaused',
  unavailable: 'player.balance.payoutUnavailable',
};

/** A payout account in one line: "HDFC Bank · UPI arjun.mehta@hdfcbank", or the bank and the account's last four digits. */
export function payoutLine(account: Pick<PayoutAccount, 'kind' | 'bankName' | 'vpa' | 'accountNumber'>): string {
  if (account.kind === 'upi') return t('player.balance.payoutUpi', { bank: account.bankName, vpa: account.vpa ?? '' });
  return t('player.balance.payoutBank', { bank: account.bankName, last: (account.accountNumber ?? '').slice(-4) });
}

/** Where the account stands: verified, waiting for the cage, or turned down and why. */
export function payoutStatus(account: PayoutAccount): string {
  if (account.status === 'verified') return t('player.balance.payoutVerified');
  if (account.status === 'pending') return t('player.balance.payoutPending');
  return t('player.balance.payoutRejected', { reason: account.rejectReason ?? '' });
}

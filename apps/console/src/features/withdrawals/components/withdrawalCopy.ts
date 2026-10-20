import type { WaitingWithdrawal, WithdrawalFailure } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';

/** Why a step on a withdrawal was refused, for the cage. */
export const WITHDRAWAL_FAILURE_COPY: Readonly<Record<WithdrawalFailure, MessageKey>> = {
  no_shift: 'console.cage.noShift',
  wallet_short: 'console.withdrawals.invalid',
  invalid: 'console.withdrawals.invalid',
  kyc_needed: 'console.withdrawals.invalid',
  not_verified: 'console.withdrawals.invalid',
  already_waiting: 'console.withdrawals.invalid',
  marker_past_due: 'console.withdrawals.invalid',
  needs_second: 'console.withdrawals.needsSecondFailure',
  utr_used: 'console.withdrawals.utrUsed',
  switched_off: 'console.withdrawals.switchedOff',
  paused: 'console.withdrawals.paused',
  stopped: 'console.withdrawals.stopped',
  not_allowed: 'console.withdrawals.notAllowedFailure',
  unavailable: 'console.withdrawals.unavailable',
};

/** Where the money goes: the UPI address, or the bank, number, IFSC and the name on it (as the cage lists payout accounts). */
export function accountLine(withdrawal: WaitingWithdrawal): string {
  if (withdrawal.kind === 'upi') return t('console.cage.payoutUpi', { vpa: withdrawal.vpa ?? '', bank: withdrawal.bankName });
  return t('console.cage.payoutBank', {
    bank: withdrawal.bankName, number: withdrawal.accountNumber ?? '', ifsc: withdrawal.ifsc ?? '', holder: withdrawal.holderName ?? '',
  });
}

/** The second approver's state: who has approved, or that one is still needed; nothing below the threshold. */
export function secondLine(withdrawal: WaitingWithdrawal): string | null {
  if (!withdrawal.needsSecond) return null;
  if (withdrawal.approvedBy.length > 0) return t('console.withdrawals.approvedBy', { names: withdrawal.approvedBy.join(', ') });
  return t('console.withdrawals.needsSecond');
}

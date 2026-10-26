import type { AccountFailure, PaymentAccount } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';

// The statement's kinds of entry the copy names; any other shows as the ledger names it.
const NAMED_ENTRIES = ['opening_balance', 'buy_in', 'cash_out', 'marker_repayment', 'account_transfer', 'expense', 'withdrawal', 'deposit'] as const;

/** A statement line's kind, in words: `Marker repayment`. */
export function entryLabel(kind: string): string {
  const named = NAMED_ENTRIES.find((entry) => entry === kind);
  return named === undefined ? kind : t(`console.accounts.entryKinds.${named}`);
}

/** An account's kind, in words: `Cash drawer`, `UPI` or `Bank`. */
export function kindLabel(kind: PaymentAccount['kind']): string {
  return t(`console.accounts.kinds.${kind}`);
}

/** Why an account or a transfer did not go through. */
export const ACCOUNT_FAILURE_COPY: Readonly<Record<AccountFailure, MessageKey>> = {
  not_allowed: 'console.accounts.failures.not_allowed',
  invalid: 'console.accounts.failures.invalid',
  paused: 'console.accounts.failures.paused',
  no_shift: 'console.accounts.failures.no_shift',
  unavailable: 'console.accounts.failures.unavailable',
};

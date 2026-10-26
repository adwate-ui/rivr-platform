import type { ExpenseFailure, VenueExpense } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';

/** Why an expense did not go through. */
export const EXPENSE_FAILURE_COPY: Readonly<Record<ExpenseFailure, MessageKey>> = {
  not_allowed: 'console.expenses.failures.not_allowed',
  invalid: 'console.expenses.failures.invalid',
  receipt_failed: 'console.expenses.failures.receipt_failed',
  paused: 'console.expenses.failures.paused',
  no_shift: 'console.expenses.failures.no_shift',
  unavailable: 'console.expenses.failures.unavailable',
};

/** Where an expense stands, then who asked: `Waiting · Asked by Rohit Chauhan`, `Approved by Aditya Malhotra · Asked by Rohit Chauhan`. */
export function statusLine(expense: VenueExpense): string {
  const status = t(`console.expenses.statuses.${expense.status}`);
  const decided = expense.decidedBy === null ? status : t('console.expenses.decidedBy', { status, name: expense.decidedBy });
  return `${decided} · ${t('console.expenses.askedBy', { name: expense.requestedBy })}`;
}

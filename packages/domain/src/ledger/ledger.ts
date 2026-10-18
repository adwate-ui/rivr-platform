import type { LedgerAccountId } from '@rivr/contracts';
import { negate, sum, type Paise } from '../money/index.ts';

/** One line of a ledger transaction. Debits are positive and credits negative, so a transaction sums to zero. */
export interface LedgerLine {
  readonly account: LedgerAccountId;
  readonly amount: Paise;
}

/** True when the lines sum to zero, as every transaction must. No lines move nothing, so they balance. */
export function isBalanced(lines: readonly LedgerLine[]): boolean {
  return sum(lines.map((line) => line.amount)) === 0n;
}

/** Throws unless the lines sum to zero. Every money function calls it before it returns lines. */
export function assertBalanced(lines: readonly LedgerLine[]): void {
  const total = sum(lines.map((line) => line.amount));
  if (total !== 0n) throw new Error(`Ledger lines do not balance: they sum to ${total} paise`);
}

/** The net of every line on one account. A balance is always a sum like this, never a stored number. */
export function balanceOf(account: LedgerAccountId, lines: readonly LedgerLine[]): Paise {
  return sum(lines.filter((line) => line.account === account).map((line) => line.amount));
}

/** The lines that undo `lines`: same accounts, opposite signs. Corrections are reversals, never edits. */
export function reverse(lines: readonly LedgerLine[]): LedgerLine[] {
  return lines.map((line) => ({ account: line.account, amount: negate(line.amount) }));
}

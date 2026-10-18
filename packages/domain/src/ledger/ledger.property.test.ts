import { newId } from '@rivr/testing';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fromPaise, negate, sum } from '../money/index.ts';
import { balanceOf, isBalanced, reverse, type LedgerLine } from './ledger.ts';

const accounts = [newId.ledgerAccount(), newId.ledgerAccount(), newId.ledgerAccount(), newId.ledgerAccount()];
const [firstAccount] = accounts;
const line = fc.record({
  account: fc.constantFrom(...accounts),
  amount: fc.bigInt({ min: -(10n ** 12n), max: 10n ** 12n }).map(fromPaise),
});

/** Any lines plus one closing line on the first account, so the whole set sums to zero. */
const balancedLines = fc.array(line, { maxLength: 12 }).map((lines): LedgerLine[] => {
  if (firstAccount === undefined) throw new Error('no accounts');
  return [...lines, { account: firstAccount, amount: negate(sum(lines.map((entry) => entry.amount))) }];
});

describe('ledger properties', () => {
  it('stays balanced when reversed', () => {
    fc.assert(
      fc.property(balancedLines, (lines) => {
        expect(isBalanced(lines)).toBe(true);
        expect(isBalanced(reverse(lines))).toBe(true);
      }),
    );
  });

  it('brings every account back to zero once the reversal is posted', () => {
    fc.assert(
      fc.property(balancedLines, (lines) => {
        const corrected = [...lines, ...reverse(lines)];
        for (const account of accounts) expect(balanceOf(account, corrected)).toBe(0n);
      }),
    );
  });

  it('splits the total across accounts without losing a paisa', () => {
    fc.assert(
      fc.property(fc.array(line, { maxLength: 12 }), (lines) => {
        const perAccount = accounts.map((account) => balanceOf(account, lines));
        expect(sum(perAccount)).toBe(sum(lines.map((entry) => entry.amount)));
      }),
    );
  });
});

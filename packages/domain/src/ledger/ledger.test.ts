import { newId } from '@rivr/testing';
import { describe, expect, it } from 'vitest';
import { fromRupees } from '../money/index.ts';
import { assertBalanced, balanceOf, isBalanced, reverse, type LedgerLine } from './ledger.ts';

const cash = newId.ledgerAccount();
const cage = newId.ledgerAccount();
const rake = newId.ledgerAccount();

// Design prompt flow 3: a ₹10,000 buy-in from Arjun's wallet.
const buyIn: LedgerLine[] = [
  { account: cash, amount: fromRupees(10_000n) },
  { account: cage, amount: fromRupees(-10_000n) },
];

describe('ledger lines', () => {
  it('balances when debits and credits sum to zero', () => {
    expect(isBalanced(buyIn)).toBe(true);
    expect(isBalanced([...buyIn, { account: rake, amount: fromRupees(1n) }])).toBe(false);
  });

  it('treats no lines as balanced, since nothing moved', () => {
    expect(isBalanced([])).toBe(true);
  });

  it('throws on unbalanced lines, which are always a bug', () => {
    expect(() => assertBalanced(buyIn)).not.toThrow();
    expect(() => assertBalanced([{ account: cash, amount: fromRupees(100n) }])).toThrow(
      /Ledger lines do not balance: they sum to 10000 paise/,
    );
  });

  it('nets the lines of one account', () => {
    const lines: LedgerLine[] = [
      ...buyIn,
      { account: cash, amount: fromRupees(-2_400n) },
      { account: rake, amount: fromRupees(2_400n) },
    ];

    expect(balanceOf(cash, lines)).toBe(fromRupees(7_600n));
    expect(balanceOf(rake, lines)).toBe(fromRupees(2_400n));
    expect(balanceOf(newId.ledgerAccount(), lines)).toBe(0n);
  });

  it('reverses lines into a correcting entry on the same accounts', () => {
    expect(reverse(buyIn)).toEqual([
      { account: cash, amount: fromRupees(-10_000n) },
      { account: cage, amount: fromRupees(10_000n) },
    ]);
  });
});

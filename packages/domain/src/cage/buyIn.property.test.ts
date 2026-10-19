import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { add, fromPaise, isChipMultiple } from '../money/index.ts';
import { buyIn, walletAfter, type BuyInMethod } from './buyIn.ts';

const chips = fc.bigInt({ min: 0n, max: 200_000n }).map((count) => fromPaise(count * 5_000n));
const methods = fc.constantFrom<BuyInMethod>('cash', 'upi', 'wallet');

describe('buyIn properties', () => {
  it('only ever lets through whole ₹50 chips, at least the minimum', () => {
    fc.assert(fc.property(methods, fc.bigInt({ min: -1n, max: 10_000_000n }).map(fromPaise), chips, chips, (method, amount, minimum, wallet) => {
      if (buyIn(method, amount, minimum, wallet).ok) {
        expect(isChipMultiple(amount) && amount > 0n && amount >= minimum).toBe(true);
      }
    }));
  });

  it('never takes more from the wallet than it holds, and cash and UPI never look at it', () => {
    fc.assert(fc.property(chips, chips, chips, (amount, minimum, wallet) => {
      const fromWallet = buyIn('wallet', amount, minimum, wallet);
      if (fromWallet.ok) expect(amount <= wallet).toBe(true);
      expect(buyIn('cash', amount, minimum, wallet)).toEqual(buyIn('cash', amount, minimum, add(wallet, fromPaise(5_000n))));
    }));
  });

  it('leaves the wallet what it held less the buy-in, never below nothing, and only for a wallet buy-in', () => {
    fc.assert(fc.property(methods, chips, chips, (method, amount, wallet) => {
      const left = walletAfter(method, amount, wallet);
      if (method !== 'wallet' || amount === 0n || amount > wallet) expect(left).toBeNull();
      else expect(left).toBe(wallet - amount);
    }));
  });
});

describe('walletAfter', () => {
  it('₹10,000 from a ₹2,00,000 wallet leaves ₹1,90,000; all of it leaves nothing; more is not a wallet buy-in', () => {
    expect(walletAfter('wallet', fromPaise(1_000_000n), fromPaise(20_000_000n))).toBe(19_000_000n);
    expect(walletAfter('wallet', fromPaise(1_000_000n), fromPaise(1_000_000n))).toBe(0n);
    expect(walletAfter('wallet', fromPaise(1_000_050n), fromPaise(1_000_000n))).toBeNull();
    expect(walletAfter('wallet', fromPaise(0n), fromPaise(1_000_000n))).toBeNull();
    expect(walletAfter('cash', fromPaise(1_000_000n), fromPaise(20_000_000n))).toBeNull();
  });
});

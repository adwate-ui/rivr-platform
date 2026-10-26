import { describe, expect, it } from 'vitest';
import { entryLabel, kindLabel } from './accountCopy.ts';

describe('the Accounts screen\'s copy (#94)', () => {
  it('names the statement\'s entries, and shows any other as the ledger names it', () => {
    expect(entryLabel('opening_balance')).toBe('Balance before');
    expect(entryLabel('marker_repayment')).toBe('Marker repayment');
    expect(entryLabel('account_transfer')).toBe('Transfer');
    expect(entryLabel('tds_remittance')).toBe('tds_remittance');
  });

  it('names each kind of account', () => {
    expect(kindLabel('cash_drawer')).toBe('Cash drawer');
    expect(kindLabel('upi')).toBe('UPI');
    expect(kindLabel('bank')).toBe('Bank');
  });
});

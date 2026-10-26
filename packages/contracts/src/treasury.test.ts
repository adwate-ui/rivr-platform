import { describe, expect, it } from 'vitest';
import {
  expenseCategorySchema, expenseRejectionSchema, expenseRequestSchema, paymentAccountSchema, repaymentSchema, transferSchema,
} from './treasury.ts';

const A = '00000000-0000-4000-8000-0000000000a1';
const B = '00000000-0000-4000-8000-0000000000b2';

describe('a marker repayment (#92)', () => {
  it('takes whole rupees by cash, or by UPI with a 12-digit UTR', () => {
    expect(repaymentSchema.safeParse({ memberId: A, amount: '60000', method: 'cash', utr: '' }).success).toBe(true);
    expect(repaymentSchema.safeParse({ memberId: A, amount: '10000', method: 'upi', utr: ' 123456789012 ' }).success).toBe(true);
  });

  it('refuses UPI without its UTR, part of a rupee, nothing, or another method', () => {
    expect(repaymentSchema.safeParse({ memberId: A, amount: '10000', method: 'upi', utr: '12345' }).success).toBe(false);
    expect(repaymentSchema.safeParse({ memberId: A, amount: '100.50', method: 'cash', utr: '' }).success).toBe(false);
    expect(repaymentSchema.safeParse({ memberId: A, amount: '0', method: 'cash', utr: '' }).success).toBe(false);
    expect(repaymentSchema.safeParse({ memberId: A, amount: '100', method: 'wallet', utr: '' }).success).toBe(false);
  });
});

describe('payment accounts and transfers (#94)', () => {
  it('adds a UPI handle or a bank account with a name, the details optional', () => {
    expect(paymentAccountSchema.safeParse({ kind: 'upi', name: 'Club UPI', details: 'rivr@okhdfc' }).success).toBe(true);
    expect(paymentAccountSchema.safeParse({ kind: 'bank', name: 'HDFC current', details: '' }).success).toBe(true);
    expect(paymentAccountSchema.safeParse({ kind: 'cash_drawer', name: 'Second drawer', details: '' }).success).toBe(false);
    expect(paymentAccountSchema.safeParse({ kind: 'upi', name: '  ', details: '' }).success).toBe(false);
  });

  it('moves whole rupees between two different accounts', () => {
    expect(transferSchema.safeParse({ fromId: A, toId: B, amount: '40000', note: '' }).success).toBe(true);
    expect(transferSchema.safeParse({ fromId: A, toId: A, amount: '40000', note: '' }).success).toBe(false);
    expect(transferSchema.safeParse({ fromId: A, toId: B, amount: '400.5', note: '' }).success).toBe(false);
  });
});

describe('expenses (#95)', () => {
  it('asks for an expense in a category, from an account, with a payee', () => {
    expect(expenseRequestSchema.safeParse({ categoryId: A, accountId: B, amount: '2500', payee: 'Fresh Fruits Co', note: '' }).success).toBe(true);
    expect(expenseRequestSchema.safeParse({ categoryId: A, accountId: B, amount: '2500', payee: ' ', note: '' }).success).toBe(false);
    expect(expenseRequestSchema.safeParse({ categoryId: 'food', accountId: B, amount: '2500', payee: 'Caterer', note: '' }).success).toBe(false);
  });

  it('names a category, and turns an expense down only with a reason', () => {
    expect(expenseCategorySchema.safeParse({ name: 'Food and drink' }).success).toBe(true);
    expect(expenseCategorySchema.safeParse({ name: '' }).success).toBe(false);
    expect(expenseRejectionSchema.safeParse({ reason: 'No caterer this month' }).success).toBe(true);
    expect(expenseRejectionSchema.safeParse({ reason: '   ' }).success).toBe(false);
  });
});

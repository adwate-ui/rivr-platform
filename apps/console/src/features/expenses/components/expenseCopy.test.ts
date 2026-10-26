import type { VenueExpense } from '@rivr/db';
import { fromPaise } from '@rivr/domain/money';
import { describe, expect, it } from 'vitest';
import { statusLine } from './expenseCopy.ts';

const WAITING: VenueExpense = {
  id: 'e1', category: 'Food and drink', account: 'Cash drawer', amount: fromPaise(250_000n), payee: 'Fresh Fruits Co', note: null, receiptPath: null,
  status: 'requested', requestedBy: 'Rohit Chauhan', isMine: false, requestedAt: '2026-11-15T20:00:00Z', decidedBy: null, decidedAt: null, decisionNote: null,
};

describe('an expense\'s status line (#95)', () => {
  it('says it waits, and who asked', () => {
    expect(statusLine(WAITING)).toBe('Waiting · Asked by Rohit Chauhan');
  });

  it('says who approved it or turned it down', () => {
    expect(statusLine({ ...WAITING, status: 'approved', decidedBy: 'Aditya Malhotra' })).toBe('Approved by Aditya Malhotra · Asked by Rohit Chauhan');
    expect(statusLine({ ...WAITING, status: 'rejected', decidedBy: 'Nisha Arora' })).toBe('Turned down by Nisha Arora · Asked by Rohit Chauhan');
  });
});

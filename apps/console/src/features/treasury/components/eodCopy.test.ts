import type { EodClose } from '@rivr/db';
import { fromPaise } from '@rivr/domain/money';
import { describe, expect, it } from 'vitest';
import { closeLine, closeStatus, figureRows } from './eodCopy.ts';

const even = (paise: bigint) => ({ counted: fromPaise(paise), expected: fromPaise(paise), variance: fromPaise(0n) });
const SHORT: EodClose = {
  closeId: 'c1', openedAt: '2026-10-20T12:30:00Z', openedBy: 'Sana Qureshi', float: fromPaise(120_600_000n), closedAt: '2026-10-21T02:30:00Z',
  closedBy: 'Sana Qureshi', mayReview: true,
  cash: { counted: fromPaise(120_550_000n), expected: fromPaise(120_600_000n), variance: fromPaise(-50_000n) },
  chips: even(62_400_000n), receipts: even(0n), markers: even(5_000_000n), isAnomaly: true, review: null,
};

describe('what the End of day says (#45)', () => {
  it('says when the shift opened and closed, in IST, and who closed it', () => {
    expect(closeLine(SHORT)).toBe('Tue 20 Oct, 18:00 to Wed 21 Oct, 08:00, closed by Sana Qureshi');
  });

  it('gives each figure counted, expected and its variance, marking those out', () => {
    expect(figureRows(SHORT)).toEqual([
      { label: 'Cash in the drawer', text: 'Counted ₹12,05,500 · expected ₹12,06,000 · variance −₹500', isOut: true },
      { label: 'Chips in the cage', text: 'Counted ₹6,24,000 · expected ₹6,24,000 · variance ₹0', isOut: false },
      { label: 'UPI and bank receipts', text: 'Counted ₹0 · expected ₹0 · variance ₹0', isOut: false },
      { label: 'Signed markers held', text: 'Counted ₹50,000 · expected ₹50,000 · variance ₹0', isOut: false },
    ]);
  });

  it('says where a close stands: clean, waiting for its reason, or reviewed with it', () => {
    expect(closeStatus({ ...SHORT, isAnomaly: false })).toBe('Closed to zero variance.');
    expect(closeStatus(SHORT)).toBe('Variance. The day closes once a manager gives the reason.');
    expect(closeStatus({ ...SHORT, review: { reason: 'A note paid out twice', reviewedBy: 'Aditya Malhotra', reviewedAt: '2026-10-21T03:00:00Z' } }))
      .toBe('Reviewed by Aditya Malhotra: A note paid out twice');
  });
});

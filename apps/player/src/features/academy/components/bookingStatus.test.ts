import type { AcademyBooking } from '@rivr/db';
import { describe, expect, it } from 'vitest';
import { bookingStatus } from './bookingStatus.ts';

const seat = { id: 'k1', batchId: 'b1', batchName: 'Level 1', startsOn: '2026-11-15', endsOn: '2026-11-17', amount: 200000n };

function booking(status: AcademyBooking['status'], utr: string | null, turnedDownUtr: string | null): AcademyBooking {
  return { ...seat, status, utr, turnedDownUtr };
}

describe('bookingStatus', () => {
  it('says where a seat stands, with the UTR given', () => {
    expect(bookingStatus(booking('awaiting_payment', null, null))).toBe('Booked. Pay to keep your seat.');
    expect(bookingStatus(booking('payment_claimed', '412345678902', null))).toBe(
      'Payment sent with UTR 412345678902. The cashier checks it against the bank, usually within a day.',
    );
    expect(bookingStatus(booking('paid', '412345678902', null))).toBe('Paid. Your seat is confirmed.');
  });

  it('names a UTR the cashier could not find, so the member checks it rather than paying again', () => {
    expect(bookingStatus(booking('awaiting_payment', null, '412345678901'))).toBe(
      'The cashier could not find UTR 412345678901 in the bank. Check it in your UPI app and give it again.',
    );
  });
});

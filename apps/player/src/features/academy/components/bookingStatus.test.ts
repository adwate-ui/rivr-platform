import type { AcademyBooking } from '@rivr/db';
import { describe, expect, it } from 'vitest';
import { bookingStatus, holdLine } from './bookingStatus.ts';

// Held until 15:30 IST on Tuesday 20 October.
const HOLD_UNTIL = '2026-10-20T10:00:00+00:00';
const seat = { id: 'k1', batchId: 'b1', batchName: 'Level 1', startsOn: '2026-11-15', endsOn: '2026-11-17', amount: 200000n, holdUntil: HOLD_UNTIL };

function booking(status: AcademyBooking['status'], utr: string | null, turnedDownUtr: string | null): AcademyBooking {
  return { ...seat, status, utr, turnedDownUtr };
}

describe('holdLine', () => {
  it('says until when an unpaid seat is held, in IST', () => {
    expect(holdLine(booking('awaiting_payment', null, null), new Date('2026-10-19T10:00:00Z'))).toBe('Pay by Tuesday 20 Oct 2026, 15:30.');
  });

  it('says the seat is no longer held once the time has passed, and that paying still seats them', () => {
    expect(holdLine(booking('awaiting_payment', null, null), new Date('2026-10-20T10:00:01Z'))).toBe(
      'Your seat is no longer held, so it may go to another member. Paying now still seats you.',
    );
  });

  it('says nothing once a UTR is given or the seat is paid', () => {
    expect(holdLine({ ...booking('payment_claimed', '412345678902', null), holdUntil: null }, new Date('2026-10-19T10:00:00Z'))).toBeNull();
    expect(holdLine({ ...booking('paid', '412345678902', null), holdUntil: null }, new Date('2026-10-19T10:00:00Z'))).toBeNull();
  });
});

describe('bookingStatus', () => {
  it('says a seat the cage cancelled after its hold, with the UTR it could not find, and what to do if they paid', () => {
    expect(bookingStatus(booking('cancelled', null, '412345678901'))).toBe(
      'Cancelled. The cashier could not find UTR 412345678901 in the bank, and your seat was no longer held. If you paid, show the payment at the front desk.',
    );
  });

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

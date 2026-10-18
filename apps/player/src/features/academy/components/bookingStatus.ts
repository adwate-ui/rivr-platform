import type { AcademyBooking } from '@rivr/db';
import { formatDate, formatTime, formatWeekday, t } from '@rivr/i18n';

/** Where a member's seat stands, in words: paid, waiting for the cashier, turned down, cancelled, or to pay. */
export function bookingStatus(booking: AcademyBooking): string {
  if (booking.status === 'paid') return t('player.academy.paid');
  if (booking.status === 'cancelled') return t('player.academy.cancelled', { utr: booking.turnedDownUtr ?? '' });
  if (booking.status === 'payment_claimed') return t('player.academy.paymentSent', { utr: booking.utr ?? '' });
  if (booking.turnedDownUtr !== null) return t('player.academy.turnedDown', { utr: booking.turnedDownUtr });
  return t('player.academy.awaitingPayment');
}

/**
 * Until when an unpaid seat is held (the database says when, #247), or that it no longer is. Nothing
 * once a UTR is given or the seat is paid.
 */
export function holdLine(booking: AcademyBooking, now: Date): string | null {
  if (booking.status !== 'awaiting_payment' || booking.holdUntil === null) return null;
  const until = new Date(booking.holdUntil);
  if (until <= now) return t('player.academy.holdLapsed');
  return t('player.academy.payBy', { weekday: formatWeekday(until), date: formatDate(until), time: formatTime(until) });
}

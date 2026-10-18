import type { AcademyBooking } from '@rivr/db';
import { t } from '@rivr/i18n';

/** Where a member's seat stands, in words: paid, waiting for the cashier, turned down, or to pay. */
export function bookingStatus(booking: AcademyBooking): string {
  if (booking.status === 'paid') return t('player.academy.paid');
  if (booking.status === 'payment_claimed') return t('player.academy.paymentSent', { utr: booking.utr ?? '' });
  if (booking.turnedDownUtr !== null) return t('player.academy.turnedDown', { utr: booking.turnedDownUtr });
  return t('player.academy.awaitingPayment');
}

import type { StaffAcademyBooking } from '@rivr/db';
import { formatDate, t } from '@rivr/i18n';

/** Who a booking is for: the member, or the company with its heads and contact. */
export function bookingFor(booking: StaffAcademyBooking): string {
  if (booking.companyName === null) return booking.memberName;
  if (booking.seats === 1) return t('console.academy.companyOneHead', { company: booking.companyName, name: booking.memberName });
  return t('console.academy.company', { company: booking.companyName, seats: String(booking.seats), name: booking.memberName });
}

/** Where a booking stands: waiting for payment, a UTR waiting for the cage, or paid. */
export function bookingStatus(booking: StaffAcademyBooking): string {
  if (booking.status === 'paid') return t('console.academy.paid');
  if (booking.status === 'payment_claimed') return t('console.academy.claimed', { utr: booking.utr ?? '' });
  return t('console.academy.awaiting');
}

/** An ISO day as noon UTC, so it formats as the same day in India. */
function day(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

/** A batch's first and last days. */
export function batchDates(startsOn: string, endsOn: string): string {
  return t('console.academy.dates', { from: formatDate(day(startsOn)), to: formatDate(day(endsOn)) });
}

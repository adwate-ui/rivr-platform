import type { StaffAcademyBatch, StaffAcademyBooking } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, Heading, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { batchDates } from './bookingText.ts';
import { BookingRow } from './BookingRow.tsx';
import { CompanyBookingForm } from './CompanyBookingForm.tsx';

/** One batch: its days and seats, its bookings, and booking a company's heads on it. */
export function BatchPanel({ venueId, batch, bookings }: { venueId: string; batch: StaffAcademyBatch; bookings: readonly StaffAcademyBooking[] }) {
  const [isBookingCompany, setIsBookingCompany] = useState(false);
  const taken = bookings.reduce((sum, booking) => sum + booking.seats, 0);
  return (
    <Stack gap={4}>
      <Stack gap={1}>
        <Heading level={2}>{batch.name}</Heading>
        <Text tone="muted">{batchDates(batch.startsOn, batch.endsOn)}</Text>
        <Text tone="muted">{t('console.academy.booked', { taken: String(taken), seats: String(batch.seats) })}</Text>
        {batch.isOpen ? null : <Text tone="muted">{t('console.academy.closed')}</Text>}
      </Stack>
      {bookings.length === 0 ? (
        <Text tone="muted">{t('console.academy.noBookings')}</Text>
      ) : (
        <Stack gap={4} divided>
          {bookings.map((booking) => <BookingRow key={booking.id} venueId={venueId} booking={booking} />)}
        </Stack>
      )}
      {isBookingCompany ? (
        <CompanyBookingForm venueId={venueId} batchId={batch.id} onDone={() => setIsBookingCompany(false)} />
      ) : (
        <Button variant="secondary" onClick={() => setIsBookingCompany(true)}>
          {t('console.academy.bookCompany')}
        </Button>
      )}
    </Stack>
  );
}

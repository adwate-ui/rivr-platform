import type { IndianMobile } from '@rivr/contracts';
import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RivrClient } from './client.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/**
 * An Academy batch as staff see it: dates as ISO days, seats, the seats taken as the database counts
 * them (paid and claimed, and unpaid for 48 hours), and whether it takes bookings.
 */
export interface StaffAcademyBatch {
  readonly id: string;
  readonly name: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly seats: number;
  readonly seatsTaken: number;
  readonly isOpen: boolean;
}

/**
 * A booking as staff see it: the member (a company's contact for a corporate one), the amount in
 * paise, the UTR given, and the staff member who recorded it, who never confirms it themselves.
 */
export interface StaffAcademyBooking {
  readonly id: string;
  readonly batchId: string;
  readonly memberName: string;
  readonly companyName: string | null;
  readonly seats: number;
  readonly amount: bigint;
  readonly status: 'awaiting_payment' | 'payment_claimed' | 'paid';
  readonly utr: string | null;
  readonly recordedByStaffId: string | null;
}

/** Why a staff step on the Academy did not go through, as the console tells it. */
export type AcademyStaffFailure =
  | 'not_allowed' | 'no_member' | 'invalid' | 'full' | 'closed' | 'no_fee' | 'no_payment' | 'utr_mismatch' | 'utr_used'
  | 'stopped' | 'no_shift' | 'unavailable';

// Not a database code: the contact's number matched no member of the venue.
const NO_MEMBER = 'no-member';

const FAILURE_BY_CODE: Readonly<Record<string, AcademyStaffFailure>> = {
  '42501': 'not_allowed', [NO_MEMBER]: 'no_member', '22023': 'invalid', RVFUL: 'full', RVBAT: 'closed', RVPRC: 'no_fee',
  RVPAY: 'no_payment', RVUTM: 'utr_mismatch', RVUTR: 'utr_used', RVFRZ: 'stopped', RVMBR: 'stopped', RVKIL: 'stopped', RVNSH: 'no_shift',
};

const STATUSES = ['awaiting_payment', 'payment_claimed', 'paid'] as const;

/** A status this console knows; anything else is a fault, never shown as some other status. */
function toStatus(value: string): StaffAcademyBooking['status'] {
  const status = STATUSES.find((known) => known === value);
  if (status === undefined) throw new Error(`Unknown Academy booking status: ${value}`);
  return status;
}

/** The venue's Academy batches, soonest first, open or closed. For Academy staff and the cage. */
export function useStaffAcademyBatches(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: [...queryKeys.academyStaff(userId ?? 'signed-out', venueId), 'batches'],
    enabled: userId !== null,
    queryFn: async (): Promise<StaffAcademyBatch[]> => {
      const { data, error } = await client.rpc('staff_academy_batches', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({
        id: row.id, name: row.name, startsOn: row.starts_on, endsOn: row.ends_on, seats: row.seats, seatsTaken: row.seats_taken,
        isOpen: row.is_open,
      }));
    },
  });
}

/** The venue's Academy bookings that are not cancelled, oldest first. */
export function useStaffAcademyBookings(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: [...queryKeys.academyStaff(userId ?? 'signed-out', venueId), 'bookings'],
    enabled: userId !== null,
    queryFn: async (): Promise<StaffAcademyBooking[]> => {
      const { data, error } = await client.from('academy_booking')
        .select('id, batch_id, company_name, seats, amount, status, utr, recorded_by_staff_id, member (full_name)')
        .eq('venue_id', venueId).neq('status', 'cancelled').order('created_at');
      if (error) throw error;
      // Every role that reads bookings also reads members (pgTAP 018), so the member is always there.
      return data.map((row) => ({
        id: row.id, batchId: row.batch_id, memberName: row.member.full_name, companyName: row.company_name, seats: row.seats,
        amount: BigInt(row.amount), status: toStatus(row.status), utr: row.utr, recordedByStaffId: row.recorded_by_staff_id,
      }));
    },
  });
}

type Call<Input> = (client: RivrClient, input: Input) => PromiseLike<{ error: { code?: string } | null }>;

/** One Academy step for staff: resolves to a Result and reloads the venue's Academy data. */
function useStaffAcademyStep<Input>(venueId: string, call: Call<Input>) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Input): Promise<Result<null, AcademyStaffFailure>> => {
      const { error } = await call(client, input);
      await queryClient.invalidateQueries({ queryKey: queryKeys.academyStaff(userId ?? 'signed-out', venueId) });
      return error ? err(FAILURE_BY_CODE[error.code ?? ''] ?? 'unavailable') : ok(null);
    },
  });
}

/** A company's booking: the contact is the venue's member with that number; the request id books it once. */
interface CompanyBooking {
  batchId: string;
  contactPhone: IndianMobile;
  companyName: string;
  seats: number;
  /** For the company's invoice (#249); empty when it has none. */
  companyGstin: string;
  requestId: string;
}

/**
 * The Academy steps staff take at a venue. Batches, company bookings, recording a UTR and cancelling
 * need Academy staff (`members.manage`); confirming or turning down a payment needs the cage
 * (`cage.transact`). The database checks each.
 */
export function useStaffAcademyActions(venueId: string) {
  return {
    openBatch: useStaffAcademyStep(venueId, (client, batch: { name: string; startsOn: string; endsOn: string; seats: number }) =>
      client.rpc('create_academy_batch', {
        p_venue_id: venueId, p_name: batch.name, p_starts_on: batch.startsOn, p_ends_on: batch.endsOn, p_seats: batch.seats,
      })),
    bookCompany: useStaffAcademyStep(venueId, async (client, booking: CompanyBooking) => {
      const contact = await client.from('member').select('id').eq('venue_id', venueId).eq('phone', booking.contactPhone).maybeSingle();
      if (contact.error) return contact;
      if (contact.data === null) return { error: { code: NO_MEMBER } };
      return client.rpc('book_academy_corporate', {
        p_batch_id: booking.batchId, p_member_id: contact.data.id, p_company_name: booking.companyName, p_seats: booking.seats,
        p_request_id: booking.requestId, p_company_gstin: booking.companyGstin,
      });
    }),
    recordPayment: useStaffAcademyStep(venueId, (client, payment: { bookingId: string; utr: string }) =>
      client.rpc('record_academy_payment', { p_booking_id: payment.bookingId, p_utr: payment.utr })),
    confirmPayment: useStaffAcademyStep(venueId, (client, payment: { bookingId: string; utr: string }) =>
      client.rpc('confirm_academy_payment', { p_booking_id: payment.bookingId, p_utr: payment.utr })),
    rejectPayment: useStaffAcademyStep(venueId, (client, payment: { bookingId: string; utr: string }) =>
      client.rpc('reject_academy_payment', { p_booking_id: payment.bookingId, p_utr: payment.utr })),
    cancelBooking: useStaffAcademyStep(venueId, (client, bookingId: string) => client.rpc('cancel_academy_booking', { p_booking_id: bookingId })),
  };
}

import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** A batch the member can book: dates as ISO days, the fee in paise (null until the club sets it). */
export interface AcademyBatch {
  readonly id: string;
  readonly name: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly seatsLeft: number;
  readonly fee: bigint | null;
}

export type AcademyBookingStatus = 'awaiting_payment' | 'payment_claimed' | 'paid' | 'cancelled';

/** One of the member's bookings: the amount in paise, and the UTR they gave. */
export interface AcademyBooking {
  readonly id: string;
  readonly batchId: string;
  readonly status: AcademyBookingStatus;
  readonly amount: bigint;
  readonly utr: string | null;
}

/** What to pay for a booking, and the club's UPI. */
export interface AcademyPayment {
  readonly amount: bigint;
  readonly upiVpa: string | null;
  readonly upiPayeeName: string | null;
}

/** Why an Academy step did not go through, as a screen tells it. */
export type AcademyFailure = 'full' | 'closed' | 'not_open' | 'stopped' | 'no_fee' | 'invalid_utr' | 'utr_used' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, AcademyFailure>> = {
  RVFUL: 'full',
  RVBAT: 'closed',
  '42501': 'not_open',
  RVMBR: 'stopped',
  RVFRZ: 'stopped',
  RVPRC: 'no_fee',
  '22023': 'invalid_utr',
  '23505': 'utr_used',
};

const STATUSES: readonly AcademyBookingStatus[] = ['awaiting_payment', 'payment_claimed', 'paid', 'cancelled'];

function toStatus(value: string): AcademyBookingStatus {
  return STATUSES.find((status) => status === value) ?? 'awaiting_payment';
}

/** The batches the signed-in member can book, soonest first. */
export function useAcademyBatches() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.academyBatches(userId ?? 'signed-out'),
    enabled: userId !== null,
    queryFn: async (): Promise<AcademyBatch[]> => {
      const { data, error } = await client.rpc('academy_open_batches');
      if (error) throw error;
      return data.map((row) => ({
        id: row.id, name: row.name, startsOn: row.starts_on, endsOn: row.ends_on, seatsLeft: row.seats_left,
        fee: row.fee === null ? null : BigInt(row.fee),
      }));
    },
  });
}

/** The signed-in member's bookings that are not cancelled. */
export function useAcademyBookings() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.academyBookings(userId ?? 'signed-out'),
    enabled: userId !== null,
    queryFn: async (): Promise<AcademyBooking[]> => {
      const { data, error } = await client.from('academy_booking').select('id, batch_id, status, amount, utr').neq('status', 'cancelled');
      if (error) throw error;
      return data.map((row) => ({ id: row.id, batchId: row.batch_id, status: toStatus(row.status), amount: BigInt(row.amount), utr: row.utr }));
    },
  });
}

/** What to pay for one of the member's unpaid bookings, and where; null once it is paid. */
export function useAcademyPayment(bookingId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.academyPayment(userId ?? 'signed-out', bookingId),
    enabled: userId !== null,
    queryFn: async (): Promise<AcademyPayment | null> => {
      const { data, error } = await client.rpc('academy_payment_details', { p_booking_id: bookingId }).maybeSingle();
      if (error) throw error;
      return data ? { amount: BigInt(data.amount), upiVpa: data.upi_vpa, upiPayeeName: data.upi_payee_name } : null;
    },
  });
}

/**
 * Booking a seat (`book` resolves to the booking's id) and giving the UTR of the UPI payment
 * (`claimPayment`). Each resolves to a Result and reloads the Academy data.
 */
export function useAcademyActions() {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.academy(userId ?? 'signed-out') });
  const failure = (code: string | undefined): AcademyFailure => FAILURE_BY_CODE[code ?? ''] ?? 'unavailable';

  const book = useMutation({
    mutationFn: async (batchId: string): Promise<Result<string, AcademyFailure>> => {
      const { data, error } = await client.rpc('book_academy', { p_batch_id: batchId });
      await refresh();
      return error ? err(failure(error.code)) : ok(data);
    },
  });
  const claimPayment = useMutation({
    mutationFn: async ({ bookingId, utr }: { bookingId: string; utr: string }): Promise<Result<null, AcademyFailure>> => {
      const { error } = await client.rpc('claim_academy_payment', { p_booking_id: bookingId, p_utr: utr });
      await refresh();
      return error ? err(failure(error.code)) : ok(null);
    },
  });
  return { book, claimPayment };
}

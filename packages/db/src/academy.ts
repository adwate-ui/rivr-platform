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

/** `cancelled` reaches a member only for a seat the cage cancelled by turning down a UTR after the hold (#222). */
export type AcademyBookingStatus = 'awaiting_payment' | 'payment_claimed' | 'paid' | 'cancelled';

/**
 * One of the member's own seats: its batch, the amount in paise, the UTR they gave, and the last UTR
 * the cashier could not find in the bank (cleared once they give one again).
 */
export interface AcademyBooking {
  readonly id: string;
  readonly batchId: string;
  readonly batchName: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly status: AcademyBookingStatus;
  readonly amount: bigint;
  readonly utr: string | null;
  readonly turnedDownUtr: string | null;
  /** While unpaid, when the seat stops being held (ISO timestamp, from the database); null otherwise. */
  readonly holdUntil: string | null;
}

/** What to pay for a booking, and the club's UPI. */
export interface AcademyPayment {
  readonly amount: bigint;
  readonly upiVpa: string | null;
  readonly upiPayeeName: string | null;
}

/** Why an Academy step did not go through, as a screen tells it. */
export type AcademyFailure =
  | 'full' | 'closed' | 'not_open' | 'stopped' | 'paused' | 'no_fee' | 'invalid_utr' | 'utr_used' | 'utr_locked' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, AcademyFailure>> = {
  RVFUL: 'full',
  RVBAT: 'closed',
  '42501': 'not_open',
  // The member's own account frozen, or the whole club paused (the kill switch).
  RVMBR: 'stopped',
  RVFRZ: 'paused',
  RVPRC: 'no_fee',
  '22023': 'invalid_utr',
  RVUTR: 'utr_used',
  // After the hold, a UTR given stays until the cage checks it (#222).
  RVLCK: 'utr_locked',
};

const STATUSES: readonly AcademyBookingStatus[] = ['awaiting_payment', 'payment_claimed', 'paid', 'cancelled'];

/** A status this app knows; anything else is a fault, never shown as some other status. */
function toStatus(value: string): AcademyBookingStatus {
  const status = STATUSES.find((known) => known === value);
  if (status === undefined) throw new Error(`Unknown Academy booking status: ${value}`);
  return status;
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

/**
 * The signed-in member's own seats, soonest first, also once their batch has closed or started; of the
 * cancelled ones, only a seat the cage cancelled by turning down its UTR, so the member sees why.
 * Read through `my_academy_bookings`, never the table, which shows staff the venue's bookings.
 */
export function useAcademyBookings() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.academyBookings(userId ?? 'signed-out'),
    enabled: userId !== null,
    queryFn: async (): Promise<AcademyBooking[]> => {
      const { data, error } = await client.rpc('my_academy_bookings');
      if (error) throw error;
      return data.map((row) => ({
        id: row.id, batchId: row.batch_id, batchName: row.batch_name, startsOn: row.starts_on, endsOn: row.ends_on,
        status: toStatus(row.status), amount: BigInt(row.amount), utr: row.utr, turnedDownUtr: row.turned_down_utr,
        holdUntil: row.hold_until,
      }));
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

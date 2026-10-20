import { err, ok, type Result } from '@rivr/contracts/result';
import type { Paise } from '@rivr/domain/money';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toPaise } from './parse/hands.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** Where a deposit stands: waiting for the cage, received into the wallet, or not found in the bank. */
export type DepositStatus = 'waiting' | 'received' | 'not_found';

/** One of the member's UPI deposits (#29). */
export interface Deposit {
  readonly depositId: string;
  readonly amount: Paise;
  readonly utr: string;
  readonly status: DepositStatus;
  readonly requestedAt: string;
  readonly decidedAt: string | null;
}

/** Where the member pays a deposit: the club's UPI address and the name it is under. */
export interface DepositDetails {
  readonly upiVpa: string;
  readonly payeeName: string;
}

/**
 * Why a deposit step was refused: not a member with deposits (or not allowed to decide it), not whole
 * rupees or no 12-digit UTR, no finished identity check, not a verified UPI account of theirs, the UTR used
 * already, three in a day already, the bank's amount not the member's, a second approver still needed,
 * frozen, or the server unreachable.
 */
export type DepositFailure = 'not_allowed' | 'invalid' | 'kyc_needed' | 'not_verified' | 'utr_used' | 'too_many' | 'amount_mismatch' | 'needs_second'
  | 'paused' | 'stopped' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, DepositFailure>> = {
  '42501': 'not_allowed', '22023': 'invalid', RVKYC: 'kyc_needed', RVPAY: 'not_verified', RVUTR: 'utr_used', RVMAX: 'too_many', RVAMT: 'amount_mismatch',
  RVAPP: 'needs_second', RVFRZ: 'paused', RVMBR: 'stopped',
};

const failureOf = (code: string): DepositFailure => FAILURE_BY_CODE[code] ?? 'unavailable';
const statusOf = (status: string): DepositStatus => (status === 'received' || status === 'not_found' ? status : 'waiting');

/** The club's UPI for the signed-in member's deposits; null when their tier has no deposits or none is set. */
export function useDepositDetails() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.depositDetails(userId ?? 'signed-out'),
    enabled: userId !== null,
    queryFn: async (): Promise<DepositDetails | null> => {
      const { data, error } = await client.rpc('deposit_details');
      if (error) throw error;
      const row = data[0];
      return row === undefined ? null : { upiVpa: row.upi_vpa, payeeName: row.upi_payee_name };
    },
  });
}

/** The signed-in member's deposits, newest first. */
export function useDeposits() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.deposits(userId ?? 'signed-out'),
    enabled: userId !== null,
    queryFn: async (): Promise<Deposit[]> => {
      const { data, error } = await client.rpc('my_deposits');
      if (error) throw error;
      return data.map((row) => ({
        depositId: row.id, amount: toPaise(row.amount_paise), utr: row.utr, status: statusOf(row.status), requestedAt: row.requested_at, decidedAt: row.decided_at,
      }));
    },
  });
}

/** A deposit the member says they paid: the amount, its UTR, and the verified UPI account it came from. */
export interface DepositOrder {
  readonly amount: Paise;
  readonly utr: string;
  readonly payoutAccountId: string;
  readonly requestId: string;
}

/** `request` submits a deposit once per request id; a Result with its id, reloading the member's deposits. */
export function useDepositActions() {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const request = useMutation({
    mutationFn: async (order: DepositOrder): Promise<Result<string, DepositFailure>> => {
      const { data, error } = await client.rpc('request_deposit', {
        p_amount_paise: Number(order.amount), p_utr: order.utr, p_payout_account_id: order.payoutAccountId, p_idempotency_key: order.requestId,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.deposits(userId ?? 'signed-out') });
      return error ? err(failureOf(error.code)) : ok(data);
    },
  });
  return { request };
}

/**
 * A deposit waiting for the cage: whose, the UTR to find in the bank statement and the UPI account it came
 * from, and its second approvals. Not the amount the member gave: the cage reads it from the bank (decision 0064).
 */
export interface WaitingDeposit {
  readonly depositId: string;
  readonly memberId: string;
  readonly fullName: string;
  /** The member's KYC photo in the private bucket (#58). */
  readonly photoPath: string | null;
  readonly utr: string;
  readonly fromVpa: string | null;
  readonly fromBank: string;
  readonly requestedAt: string;
  readonly needsSecond: boolean;
  readonly approvedBy: readonly string[];
}

/** The venue's deposits waiting for the cage (#29), oldest first; asked again every ten seconds. */
export function useWaitingDeposits(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.waitingDeposits(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    refetchInterval: 10_000,
    queryFn: async (): Promise<WaitingDeposit[]> => {
      const { data, error } = await client.rpc('waiting_deposits', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({
        depositId: row.request_id, memberId: row.member_id, fullName: row.full_name, photoPath: row.photo_path, utr: row.utr, fromVpa: row.from_vpa, fromBank: row.from_bank,
        requestedAt: row.requested_at, needsSecond: row.needs_second, approvedBy: row.approved_by,
      }));
    },
  });
}

/**
 * The cage's steps on a deposit: `confirm` it with the amount the bank statement shows, `reject` it as not
 * found, or `secondApprove` it from the threshold up (#20); each a Result, reloading the list.
 */
export function useDepositDecisions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const settle = async (error: { code: string } | null): Promise<Result<null, DepositFailure>> => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.waitingDeposits(userId ?? 'signed-out', venueId) });
    return error ? err(failureOf(error.code)) : ok(null);
  };
  const confirm = useMutation({
    mutationFn: async ({ depositId, bankAmount }: { depositId: string; bankAmount: Paise }) =>
      settle((await client.rpc('confirm_deposit', { p_request_id: depositId, p_bank_amount_paise: Number(bankAmount) })).error),
  });
  const reject = useMutation({
    mutationFn: async (depositId: string) => settle((await client.rpc('reject_deposit', { p_request_id: depositId })).error),
  });
  const secondApprove = useMutation({
    mutationFn: async (depositId: string) => settle((await client.rpc('second_approve_deposit', { p_request_id: depositId })).error),
  });
  return { confirm, reject, secondApprove };
}

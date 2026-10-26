import type { PayoutKind } from '@rivr/contracts/payments';
import { err, ok, type Result } from '@rivr/contracts/result';
import type { Paise } from '@rivr/domain/money';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toPaise } from './parse/hands.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** Where a withdrawal stands: waiting for the cage, sent with its UTR, or declined and returned. */
export type WithdrawalStatus = 'waiting' | 'sent' | 'declined';

/** One of the member's withdrawals (#21), with the account it went to. */
export interface Withdrawal {
  readonly withdrawalId: string;
  readonly amount: Paise;
  readonly status: WithdrawalStatus;
  readonly utr: string | null;
  readonly declineReason: string | null;
  readonly requestedAt: string;
  readonly decidedAt: string | null;
  readonly kind: PayoutKind;
  readonly bankName: string;
}

/**
 * Why a withdrawal step was refused: more than the wallet, not whole rupees, no finished identity
 * check, the account not a verified one, another waiting, a marker past due, a second approver still
 * needed, the UTR used already, switched off, frozen, not allowed, or the server unreachable.
 */
export type WithdrawalFailure = 'wallet_short' | 'invalid' | 'kyc_needed' | 'not_verified' | 'already_waiting' | 'marker_past_due'
  | 'needs_second' | 'utr_used' | 'switched_off' | 'paused' | 'stopped' | 'not_allowed' | 'no_shift' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, WithdrawalFailure>> = {
  RVSHT: 'wallet_short', '22023': 'invalid', RVKYC: 'kyc_needed', RVPAY: 'not_verified', RVPND: 'already_waiting', RVDUE: 'marker_past_due',
  RVAPP: 'needs_second', RVUTR: 'utr_used', RVKIL: 'switched_off', RVFRZ: 'paused', RVMBR: 'stopped', '42501': 'not_allowed', RVNSH: 'no_shift',
};

const failureOf = (code: string): WithdrawalFailure => FAILURE_BY_CODE[code] ?? 'unavailable';
const statusOf = (status: string): WithdrawalStatus => (status === 'sent' || status === 'declined' ? status : 'waiting');
const kindOf = (kind: string): PayoutKind => (kind === 'bank' ? 'bank' : 'upi');

/** The signed-in member's withdrawals, newest first. */
export function useWithdrawals() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.withdrawals(userId ?? 'signed-out'),
    enabled: userId !== null,
    queryFn: async (): Promise<Withdrawal[]> => {
      const { data, error } = await client.rpc('my_withdrawals');
      if (error) throw error;
      return data.map((row) => ({
        withdrawalId: row.id, amount: toPaise(row.amount_paise), status: statusOf(row.status), utr: row.utr, declineReason: row.decline_reason,
        requestedAt: row.requested_at, decidedAt: row.decided_at, kind: kindOf(row.kind), bankName: row.bank_name,
      }));
    },
  });
}

/** A withdrawal to ask for: once per request id, to one of the member's verified payout accounts. */
export interface WithdrawalOrder {
  readonly amount: Paise;
  readonly payoutAccountId: string;
  readonly requestId: string;
}

/** `request` asks to withdraw; a Result with its id, reloading the member's Balance and withdrawals. */
export function useWithdrawalActions() {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const request = useMutation({
    mutationFn: async (order: WithdrawalOrder): Promise<Result<string, WithdrawalFailure>> => {
      const { data, error } = await client.rpc('request_withdrawal', {
        p_amount_paise: Number(order.amount), p_payout_account_id: order.payoutAccountId, p_idempotency_key: order.requestId,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.wallet(userId ?? 'signed-out') }),
        queryClient.invalidateQueries({ queryKey: queryKeys.withdrawals(userId ?? 'signed-out') }),
      ]);
      return error ? err(failureOf(error.code)) : ok(data);
    },
  });
  return { request };
}

/** A withdrawal waiting for the cage: whose, how much, to which account, and its second approvals. */
export interface WaitingWithdrawal {
  readonly withdrawalId: string;
  readonly memberId: string;
  readonly fullName: string;
  /** The member's KYC photo in the private bucket (#58). */
  readonly photoPath: string | null;
  readonly amount: Paise;
  readonly kind: PayoutKind;
  readonly bankName: string;
  readonly vpa: string | null;
  readonly accountNumber: string | null;
  readonly ifsc: string | null;
  readonly holderName: string | null;
  readonly requestedAt: string;
  readonly needsSecond: boolean;
  readonly approvedBy: readonly string[];
  /** `paying` while a Cashfree payout is on its way (#475). */
  readonly status: 'waiting' | 'paying';
  /** Why the last Cashfree payout failed, or was reversed; null when none has. */
  readonly payoutFailure: string | null;
}

/** The venue's withdrawals waiting for the cage (#21), oldest first; asked again every few seconds. */
export function useWaitingWithdrawals(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.waitingWithdrawals(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    refetchInterval: 5_000,
    queryFn: async (): Promise<WaitingWithdrawal[]> => {
      const { data, error } = await client.rpc('waiting_withdrawals', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({
        withdrawalId: row.request_id, memberId: row.member_id, fullName: row.full_name, photoPath: row.photo_path, amount: toPaise(row.amount_paise), kind: kindOf(row.kind),
        bankName: row.bank_name, vpa: row.vpa, accountNumber: row.account_number, ifsc: row.ifsc, holderName: row.holder_name,
        requestedAt: row.requested_at, needsSecond: row.needs_second, approvedBy: row.approved_by,
        status: row.status === 'paying' ? 'paying' : 'waiting', payoutFailure: row.payout_failure,
      }));
    },
  });
}

/**
 * The cage's steps on a waiting withdrawal: `secondApprove` (a second approver, #20), `send` with the
 * bank's UTR, `payInCash` from the drawer and `payThroughCashfree` (#475), and `decline` with a reason; each a
 * Result, reloading the list.
 */
export function useWithdrawalDecisions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const settle = async (error: { code: string } | null): Promise<Result<null, WithdrawalFailure>> => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.waitingWithdrawals(userId ?? 'signed-out', venueId) });
    return error ? err(failureOf(error.code)) : ok(null);
  };
  const secondApprove = useMutation({
    mutationFn: async (withdrawalId: string) => settle((await client.rpc('second_approve_withdrawal', { p_request_id: withdrawalId })).error),
  });
  const send = useMutation({
    mutationFn: async ({ withdrawalId, utr }: { withdrawalId: string; utr: string }) =>
      settle((await client.rpc('send_withdrawal', { p_request_id: withdrawalId, p_utr: utr })).error),
  });
  const decline = useMutation({
    mutationFn: async ({ withdrawalId, reason }: { withdrawalId: string; reason: string }) =>
      settle((await client.rpc('decline_withdrawal', { p_request_id: withdrawalId, p_reason: reason })).error),
  });
  const payInCash = useMutation({
    mutationFn: async (withdrawalId: string) => settle((await client.rpc('pay_withdrawal_in_cash', { p_request_id: withdrawalId })).error),
  });
  const payThroughCashfree = useMutation({
    mutationFn: async (withdrawalId: string) => settle((await client.rpc('pay_withdrawal_through_cashfree', { p_request_id: withdrawalId })).error),
  });
  return { secondApprove, send, decline, payInCash, payThroughCashfree };
}

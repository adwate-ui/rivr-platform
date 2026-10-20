// Types only: the schemas' module brings zod, and this package is in the player's first download.
import type { PayoutAccountInput, PayoutKind } from '@rivr/contracts/payments';
import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** Where a payout account stands: waiting for the cage, verified (usable), or turned down with a reason. */
export const PAYOUT_STATUSES = ['pending', 'verified', 'rejected'] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

/** One of the member's payout accounts (#19): a UPI address, or a bank account by number and IFSC. */
export interface PayoutAccount {
  readonly accountId: string;
  readonly kind: PayoutKind;
  readonly bankName: string;
  readonly vpa: string | null;
  readonly accountNumber: string | null;
  readonly ifsc: string | null;
  readonly holderName: string | null;
  readonly status: PayoutStatus;
  readonly rejectReason: string | null;
}

/**
 * Why a payout account change was refused: three in use already, that one added already, not a valid
 * account, not allowed, the member or venue frozen, or the server unreachable.
 */
export type PayoutAccountFailure = 'too_many' | 'already_added' | 'invalid' | 'not_allowed' | 'stopped' | 'paused' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, PayoutAccountFailure>> = {
  RVMAX: 'too_many', '23505': 'already_added', '22023': 'invalid', '42501': 'not_allowed', RVMBR: 'stopped', RVFRZ: 'paused',
};

const failureOf = (code: string): PayoutAccountFailure => FAILURE_BY_CODE[code] ?? 'unavailable';

interface AccountRow {
  id: string;
  kind: string;
  bank_name: string;
  vpa: string | null;
  account_number: string | null;
  ifsc: string | null;
  holder_name: string | null;
  status: string;
  reject_reason: string | null;
}

const kindOf = (kind: string): PayoutKind => (kind === 'bank' ? 'bank' : 'upi');

function accountOf(row: AccountRow): PayoutAccount {
  return {
    accountId: row.id, kind: kindOf(row.kind), bankName: row.bank_name, vpa: row.vpa,
    accountNumber: row.account_number, ifsc: row.ifsc, holderName: row.holder_name,
    status: PAYOUT_STATUSES.find((status) => status === row.status) ?? 'pending', rejectReason: row.reject_reason,
  };
}

/** The signed-in member's payout accounts in use, oldest first. */
export function usePayoutAccounts() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.payoutAccounts(userId ?? 'signed-out'),
    enabled: userId !== null,
    queryFn: async (): Promise<PayoutAccount[]> => {
      const { data, error } = await client.rpc('my_payout_accounts');
      if (error) throw error;
      return data.map(accountOf);
    },
  });
}

/** `add` a payout account as the member typed it, and `remove` one; each a Result, reloading the list. */
export function usePayoutAccountActions() {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const reload = () => queryClient.invalidateQueries({ queryKey: queryKeys.payoutAccounts(userId ?? 'signed-out') });
  const add = useMutation({
    mutationFn: async (account: PayoutAccountInput): Promise<Result<string, PayoutAccountFailure>> => {
      const { data, error } = await client.rpc('add_payout_account', account.kind === 'upi'
        ? { p_kind: 'upi', p_bank_name: account.bankName, p_vpa: account.vpa }
        : { p_kind: 'bank', p_bank_name: account.bankName, p_account_number: account.accountNumber, p_ifsc: account.ifsc, p_holder_name: account.holderName });
      await reload();
      return error ? err(failureOf(error.code)) : ok(data);
    },
  });
  const remove = useMutation({
    mutationFn: async (accountId: string): Promise<Result<null, PayoutAccountFailure>> => {
      const { error } = await client.rpc('remove_payout_account', { p_account_id: accountId });
      await reload();
      return error ? err(failureOf(error.code)) : ok(null);
    },
  });
  return { add, remove };
}

/** A payout account waiting for the cage, with whose it is. */
export interface PayoutAccountToVerify extends Omit<PayoutAccount, 'status' | 'rejectReason'> {
  readonly memberId: string;
  readonly fullName: string;
  readonly phone: string;
  readonly addedAt: string;
}

/** The venue's payout accounts waiting for the cage (#19), oldest first; asked again every few seconds. */
export function usePayoutAccountsToVerify(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.payoutAccountsToVerify(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    refetchInterval: 10_000,
    queryFn: async (): Promise<PayoutAccountToVerify[]> => {
      const { data, error } = await client.rpc('payout_accounts_to_verify', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({
        accountId: row.account_id, kind: kindOf(row.kind), bankName: row.bank_name, vpa: row.vpa, accountNumber: row.account_number, ifsc: row.ifsc,
        holderName: row.holder_name, memberId: row.member_id, fullName: row.full_name, phone: row.phone, addedAt: row.added_at,
      }));
    },
  });
}

/** A cashier's decision on a waiting account: verified, or turned down with a reason. */
export interface PayoutDecision {
  readonly accountId: string;
  readonly isVerified: boolean;
  readonly reason: string | null;
}

/** `decide` verifies a waiting payout account or turns it down; a Result, reloading the cage's list. */
export function usePayoutAccountDecisions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const decide = useMutation({
    mutationFn: async (decision: PayoutDecision): Promise<Result<null, PayoutAccountFailure>> => {
      const { error } = await client.rpc('decide_payout_account', {
        p_account_id: decision.accountId, p_is_verified: decision.isVerified, ...(decision.reason === null ? {} : { p_reason: decision.reason }),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.payoutAccountsToVerify(userId ?? 'signed-out', venueId) });
      return error ? err(failureOf(error.code)) : ok(null);
    },
  });
  return { decide };
}

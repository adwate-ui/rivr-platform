import { err, ok, type Result } from '@rivr/contracts/result';
import type { Paise } from '@rivr/domain/money';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toPaise } from './parse/hands.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** Where the club's money is (#94): the cash drawer, a UPI handle or a bank account, with what the ledger has moved through it. */
export interface PaymentAccount {
  readonly id: string;
  readonly kind: 'cash_drawer' | 'upi' | 'bank';
  readonly name: string;
  readonly details: string | null;
  readonly isActive: boolean;
  readonly balance: Paise;
}

/** One line of an account's statement: the balance before the period first, then each entry with the balance after it. */
export interface StatementLine {
  readonly occurredAt: string;
  /** What happened, as the ledger names it: opening_balance, buy_in, cash_out, marker_repayment, account_transfer, expense... */
  readonly kind: string;
  readonly memo: string | null;
  readonly amount: Paise;
  readonly balance: Paise;
}

/** Why an account or a transfer did not go through: not a treasury manager, not allowed as asked, frozen, no cage shift. */
export type AccountFailure = 'not_allowed' | 'invalid' | 'paused' | 'no_shift' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, AccountFailure>> = {
  '42501': 'not_allowed', '22023': 'invalid', RVFRZ: 'paused', RVNSH: 'no_shift',
};

const ACCOUNT_KINDS: readonly PaymentAccount['kind'][] = ['cash_drawer', 'upi', 'bank'];
const kindOf = (kind: string): PaymentAccount['kind'] => ACCOUNT_KINDS.find((known) => known === kind) ?? 'bank';

/** The venue's payment accounts with their balances: the drawer, then banks, then UPI handles. */
export function usePaymentAccounts(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.paymentAccounts(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<PaymentAccount[]> => {
      const { data, error } = await client.rpc('payment_accounts', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({
        id: row.payment_account_id, kind: kindOf(row.kind), name: row.name, details: row.details, isActive: row.is_active,
        balance: toPaise(row.balance_paise),
      }));
    },
  });
}

/** An account's statement from `from` up to `to` (ISO moments), or nothing to show while no account is chosen. */
export function useAccountStatement(accountId: string | null, from: string, to: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.accountStatement(userId ?? 'signed-out', accountId ?? '', from, to),
    enabled: userId !== null && accountId !== null,
    queryFn: async (): Promise<StatementLine[]> => {
      const { data, error } = await client.rpc('account_statement', { p_payment_account_id: accountId ?? '', p_from: from, p_to: to });
      if (error) throw error;
      return data.map((row) => ({
        occurredAt: row.occurred_at, kind: row.kind, memo: row.memo, amount: toPaise(row.amount_paise), balance: toPaise(row.balance_paise),
      }));
    },
  });
}

/** A transfer between two accounts, once per request id. */
export interface Transfer {
  readonly fromId: string;
  readonly toId: string;
  readonly amount: Paise;
  readonly note: string;
  readonly requestId: string;
}

/** `add` a UPI handle or a bank account, and `transfer` money between two accounts; each a Result, reloading balances and statements. */
export function usePaymentAccountActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const settle = async <Value,>(data: Value, error: { code: string } | null): Promise<Result<Value, AccountFailure>> => {
    await queryClient.invalidateQueries({ queryKey: ['user', userId ?? 'signed-out'] });
    return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(data);
  };
  const add = useMutation({
    mutationFn: async ({ kind, name, details }: { kind: 'upi' | 'bank'; name: string; details: string }) => {
      const { data, error } = await client.rpc('add_payment_account', { p_venue_id: venueId, p_kind: kind, p_name: name.trim(), p_details: details.trim() });
      return settle(data, error);
    },
  });
  const transfer = useMutation({
    mutationFn: async (order: Transfer) => {
      const { data, error } = await client.rpc('transfer_between_accounts', {
        p_venue_id: venueId, p_from_id: order.fromId, p_to_id: order.toId, p_amount_paise: Number(order.amount), p_note: order.note.trim(),
        p_idempotency_key: order.requestId,
      });
      return settle(data, error);
    },
  });
  return { add, transfer };
}

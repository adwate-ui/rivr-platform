import { err, ok, type Result } from '@rivr/contracts/result';
import type { Paise } from '@rivr/domain/money';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toPaise } from './parse/hands.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** A kind of spending (#95), with an expense account of its own in the ledger. */
export interface ExpenseCategory {
  readonly id: string;
  readonly name: string;
}

/** An expense on the console's list: waiting for a second person, approved (and posted) or turned down. */
export interface VenueExpense {
  readonly id: string;
  readonly category: string;
  readonly account: string;
  readonly amount: Paise;
  readonly payee: string;
  readonly note: string | null;
  /** The receipt in the private expense-receipts bucket, shown through useReceiptUrl. */
  readonly receiptPath: string | null;
  readonly status: 'requested' | 'approved' | 'rejected';
  readonly requestedBy: string;
  /** Asked for by the staff member reading: they may not decide it. */
  readonly isMine: boolean;
  readonly requestedAt: string;
  readonly decidedBy: string | null;
  readonly decidedAt: string | null;
  readonly decisionNote: string | null;
}

/** Why an expense did not go through: not allowed, not allowed as asked, the receipt not sent, frozen, no cage shift. */
export type ExpenseFailure = 'not_allowed' | 'invalid' | 'receipt_failed' | 'paused' | 'no_shift' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, ExpenseFailure>> = {
  '42501': 'not_allowed', '22023': 'invalid', RVFRZ: 'paused', RVNSH: 'no_shift',
};

const STATUSES: readonly VenueExpense['status'][] = ['requested', 'approved', 'rejected'];
const RECEIPT_EXTENSIONS: Readonly<Record<string, string>> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const RECEIPT_BUCKET = 'expense-receipts';
// How long a receipt's link works.
const RECEIPT_URL_SECONDS = 60;

/** The venue's expense categories, by name. */
export function useExpenseCategories(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.expenseCategories(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<ExpenseCategory[]> => {
      const { data, error } = await client.from('expense_category').select('id, name').eq('venue_id', venueId).order('name');
      if (error) throw error;
      return data;
    },
  });
}

/** The venue's expenses: those waiting first, then the last 90 days'. */
export function useVenueExpenses(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.venueExpenses(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<VenueExpense[]> => {
      const { data, error } = await client.rpc('venue_expenses', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({
        id: row.expense_id, category: row.category, account: row.payment_account, amount: toPaise(row.amount_paise), payee: row.payee,
        note: row.note, receiptPath: row.receipt_path, status: STATUSES.find((status) => status === row.status) ?? 'requested',
        requestedBy: row.requested_by, isMine: row.is_mine, requestedAt: row.requested_at, decidedBy: row.decided_by, decidedAt: row.decided_at,
        decisionNote: row.decision_note,
      }));
    },
  });
}

/** An expense to ask for: its id (kept across a retry), with a photo of the receipt if there is one. */
export interface ExpenseRequest {
  readonly expenseId: string;
  readonly categoryId: string;
  readonly accountId: string;
  readonly amount: Paise;
  readonly payee: string;
  readonly note: string;
  readonly receipt: File | null;
}

// A receipt already sent for this expense, by a try that failed after it, is the one to keep.
const isAlreadyThere = (error: object) => Reflect.get(error, 'statusCode') === '409' || Reflect.get(error, 'status') === 409;

/**
 * `addCategory`, `request` an expense (its receipt sent first, to <venue>/<expense>.<jpg|png|webp>) and `decide`
 * one (approve, or turn down with a reason); each a Result, reloading the list and the balances.
 */
export function useExpenseActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const settle = async <Value,>(data: Value, error: { code: string } | null): Promise<Result<Value, ExpenseFailure>> => {
    await queryClient.invalidateQueries({ queryKey: ['user', userId ?? 'signed-out'] });
    return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(data);
  };
  const sendReceipt = async (expenseId: string, receipt: File): Promise<Result<string, ExpenseFailure>> => {
    const extension = RECEIPT_EXTENSIONS[receipt.type];
    if (extension === undefined) return err('invalid');
    const path = `${venueId}/${expenseId}.${extension}`;
    const { error } = await client.storage.from(RECEIPT_BUCKET).upload(path, receipt, { contentType: receipt.type });
    return error && !isAlreadyThere(error) ? err('receipt_failed') : ok(path);
  };
  const addCategory = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await client.rpc('add_expense_category', { p_venue_id: venueId, p_name: name.trim() });
      return settle(data, error);
    },
  });
  const request = useMutation({
    mutationFn: async (order: ExpenseRequest): Promise<Result<string, ExpenseFailure>> => {
      const receipt = order.receipt === null ? ok('') : await sendReceipt(order.expenseId, order.receipt);
      if (!receipt.ok) return receipt;
      const { error } = await client.rpc('request_expense', {
        p_venue_id: venueId, p_expense_id: order.expenseId, p_category_id: order.categoryId, p_payment_account_id: order.accountId,
        p_amount_paise: Number(order.amount), p_payee: order.payee.trim(), p_note: order.note.trim(), p_receipt_path: receipt.value,
      });
      return settle(order.expenseId, error);
    },
  });
  const decide = useMutation({
    mutationFn: async ({ expenseId, isApproved, note }: { expenseId: string; isApproved: boolean; note: string }) => {
      const { error } = await client.rpc('decide_expense', { p_expense_id: expenseId, p_is_approved: isApproved, p_note: note.trim() });
      return settle(null, error);
    },
  });
  return { addCategory, request, decide };
}

/** A link to an expense's receipt, valid for a minute, for the cage and treasury managers of its venue. */
export function useReceiptUrl(path: string | null) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.receiptUrl(userId ?? 'signed-out', path ?? ''),
    enabled: userId !== null && path !== null,
    // Ask for a fresh link before this one runs out.
    staleTime: (RECEIPT_URL_SECONDS - 10) * 1000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await client.storage.from(RECEIPT_BUCKET).createSignedUrl(path ?? '', RECEIPT_URL_SECONDS);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

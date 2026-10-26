import { fromPaise } from '@rivr/domain/money';
import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useExpenseActions, useExpenseCategories, useVenueExpenses } from './expenses.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const STAFF = '00000000-0000-4000-8000-000000000140';
const VENUE = '00000000-0000-4000-8000-000000000001';

/** A fake API: each path answers with its reply; every call is kept with its address and what it sent. */
function renderExpenses(replies: Record<string, { status?: number; body: unknown }>) {
  const calls: { url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, body: typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body });
    const path = Object.keys(replies).find((key) => url.includes(key));
    const reply = path ? replies[path] : undefined;
    return Response.json(reply?.body ?? [], { status: reply?.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(STAFF), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({
    categories: useExpenseCategories(VENUE), list: useVenueExpenses(VENUE), actions: useExpenseActions(VENUE),
  }), { wrapper });
  return { result, calls };
}

const ORDER = {
  expenseId: 'e1', categoryId: 'c1', accountId: 'p1', amount: fromPaise(250_000n), payee: ' Fresh Fruits Co ', note: '',
};

afterEach(cleanup);

describe('expenses (#95)', () => {
  it('gives the categories and the list, waiting first, in paise', async () => {
    const { result } = renderExpenses({
      '/rest/v1/expense_category': { body: [{ id: 'c1', name: 'Food and drink' }] },
      '/rpc/venue_expenses': { body: [{
        expense_id: 'e1', category: 'Food and drink', payment_account: 'Cash drawer', amount_paise: 250000, payee: 'Fresh Fruits Co', note: null,
        receipt_path: `${VENUE}/e1.jpg`, status: 'requested', requested_by: 'Rohit Chauhan', is_mine: true, requested_at: '2026-11-15T20:00:00Z',
        decided_by: null, decided_at: null, decision_note: null,
      }] },
    });
    await waitFor(() => expect(result.current.categories.data).toEqual([{ id: 'c1', name: 'Food and drink' }]));
    await waitFor(() => expect(result.current.list.data?.[0]).toMatchObject({
      id: 'e1', account: 'Cash drawer', amount: 250_000n, receiptPath: `${VENUE}/e1.jpg`, status: 'requested', isMine: true,
    }));
  });

  it('sends the receipt under the venue and the expense first, then asks for the expense', async () => {
    const { result, calls } = renderExpenses({ '/rpc/request_expense': { body: 'e1' } });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.actions.request.mutateAsync({ ...ORDER, receipt: new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' }) });
    });
    expect(outcome).toEqual({ ok: true, value: 'e1' });
    expect(calls.some((call) => call.url.includes(`/storage/v1/object/expense-receipts/${VENUE}/e1.jpg`))).toBe(true);
    expect(calls.find((call) => call.url.includes('/rpc/request_expense'))?.body).toEqual({
      p_venue_id: VENUE, p_expense_id: 'e1', p_category_id: 'c1', p_payment_account_id: 'p1', p_amount_paise: 250000, p_payee: 'Fresh Fruits Co',
      p_note: '', p_receipt_path: `${VENUE}/e1.jpg`,
    });
  });

  it('asks for nothing when the receipt cannot be sent, and takes only photos', async () => {
    const { result, calls } = renderExpenses({ '/storage/v1/object/expense-receipts': { status: 403, body: { statusCode: '403', message: 'denied' } } });
    let failed: unknown;
    let notPhoto: unknown;
    await act(async () => {
      failed = await result.current.actions.request.mutateAsync({ ...ORDER, receipt: new File(['receipt'], 'receipt.png', { type: 'image/png' }) });
      notPhoto = await result.current.actions.request.mutateAsync({ ...ORDER, receipt: new File(['receipt'], 'receipt.pdf', { type: 'application/pdf' }) });
    });
    expect(failed).toEqual({ ok: false, error: 'receipt_failed' });
    expect(notPhoto).toEqual({ ok: false, error: 'invalid' });
    expect(calls.some((call) => call.url.includes('/rpc/request_expense'))).toBe(false);
  });

  it('decides an expense, saying why a decision is refused', async () => {
    const { result, calls } = renderExpenses({ '/rpc/decide_expense': { status: 403, body: { code: '42501', message: 'second person' } } });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.actions.decide.mutateAsync({ expenseId: 'e1', isApproved: false, note: ' No caterer this month ' });
    });
    expect(outcome).toEqual({ ok: false, error: 'not_allowed' });
    expect(calls.find((call) => call.url.includes('/rpc/decide_expense'))?.body).toEqual({
      p_expense_id: 'e1', p_is_approved: false, p_note: 'No caterer this month',
    });
  });
});

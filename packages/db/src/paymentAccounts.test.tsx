import { fromPaise } from '@rivr/domain/money';
import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useAccountStatement, usePaymentAccountActions, usePaymentAccounts } from './paymentAccounts.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const STAFF = '00000000-0000-4000-8000-000000000103';
const VENUE = '00000000-0000-4000-8000-000000000001';

/** A fake API: each RPC answers with its reply; every call is kept with what it was sent. */
function renderAccounts(replies: Record<string, { status?: number; body: unknown }>) {
  const calls: { rpc: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const rpc = (input instanceof Request ? input.url : String(input)).split('/rpc/')[1] ?? '';
    calls.push({ rpc, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const reply = replies[rpc];
    return Response.json(reply?.body ?? [], { status: reply?.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(STAFF), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({
    accounts: usePaymentAccounts(VENUE), statement: useAccountStatement('p1', '2026-11-01T00:00:00Z', '2026-11-16T00:00:00Z'),
    actions: usePaymentAccountActions(VENUE),
  }), { wrapper });
  return { result, calls };
}

afterEach(cleanup);

describe('payment accounts (#94)', () => {
  it('gives each account with its balance in paise', async () => {
    const { result } = renderAccounts({ payment_accounts: { body: [
      { payment_account_id: 'p1', kind: 'cash_drawer', name: 'Cash drawer', details: null, is_active: true, balance_paise: 2000000 },
      { payment_account_id: 'p2', kind: 'upi', name: 'Club UPI', details: 'rivr@okhdfc', is_active: true, balance_paise: 4000000 },
    ] } });
    await waitFor(() => expect(result.current.accounts.data).toEqual([
      { id: 'p1', kind: 'cash_drawer', name: 'Cash drawer', details: null, isActive: true, balance: 2_000_000n },
      { id: 'p2', kind: 'upi', name: 'Club UPI', details: 'rivr@okhdfc', isActive: true, balance: 4_000_000n },
    ]));
  });

  it('gives a statement for the period asked, each line with the balance after it', async () => {
    const { result, calls } = renderAccounts({ account_statement: { body: [
      { occurred_at: '2026-11-01T00:00:00Z', kind: 'opening_balance', memo: null, amount_paise: 0, balance_paise: 0 },
      { occurred_at: '2026-11-15T20:00:00Z', kind: 'account_transfer', memo: 'Banked', amount_paise: -4000000, balance_paise: -4000000 },
    ] } });
    await waitFor(() => expect(result.current.statement.data?.[1]).toEqual({
      occurredAt: '2026-11-15T20:00:00Z', kind: 'account_transfer', memo: 'Banked', amount: -4_000_000n, balance: -4_000_000n,
    }));
    expect(calls.find((call) => call.rpc === 'account_statement')?.body).toEqual({
      p_payment_account_id: 'p1', p_from: '2026-11-01T00:00:00Z', p_to: '2026-11-16T00:00:00Z',
    });
  });

  it('adds an account and moves money between two, once per request id, saying why one is refused', async () => {
    const { result, calls } = renderAccounts({
      add_payment_account: { body: 'p3' },
      transfer_between_accounts: { status: 400, body: { code: 'RVNSH', message: 'no shift' } },
    });
    let added: unknown;
    let moved: unknown;
    await act(async () => {
      added = await result.current.actions.add.mutateAsync({ kind: 'bank', name: ' HDFC current ', details: 'HDFC ••1234' });
      moved = await result.current.actions.transfer.mutateAsync({ fromId: 'p1', toId: 'p3', amount: fromPaise(4_000_000n), note: ' ', requestId: 'r1' });
    });
    expect(added).toEqual({ ok: true, value: 'p3' });
    expect(moved).toEqual({ ok: false, error: 'no_shift' });
    expect(calls.find((call) => call.rpc === 'add_payment_account')?.body).toEqual({
      p_venue_id: VENUE, p_kind: 'bank', p_name: 'HDFC current', p_details: 'HDFC ••1234',
    });
    expect(calls.find((call) => call.rpc === 'transfer_between_accounts')?.body).toEqual({
      p_venue_id: VENUE, p_from_id: 'p1', p_to_id: 'p3', p_amount_paise: 4000000, p_note: '', p_idempotency_key: 'r1',
    });
  });
});

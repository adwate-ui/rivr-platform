import { fromPaise } from '@rivr/domain/money';
import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useCageActions } from './cage.ts';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const STAFF = '00000000-0000-4000-8000-000000000104';
const VENUE = '00000000-0000-4000-8000-000000000001';

/** A fake API: each RPC answers with its reply; every call is kept with what it was sent. */
function renderCage(replies: Record<string, { status?: number; body: unknown }>) {
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
  const { result } = renderHook(() => useCageActions(VENUE), { wrapper });
  return { result, calls };
}

afterEach(cleanup);

describe('Cash-out', () => {
  it('cashes out once per request id, to cash or the wallet', async () => {
    const { result, calls } = renderCage({ cage_cash_out: { body: [{ cage_transaction_id: 't1', markers_settled_paise: 1_000_000, to_member_paise: 2_000_000 }] } });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.cashOut.mutateAsync({ memberId: 'm1', amount: fromPaise(3_000_000n), to: 'wallet', requestId: 'r1' });
    });
    expect(outcome).toEqual({ ok: true, value: { cageTransactionId: 't1', settled: 1_000_000n, toMember: 2_000_000n } });
    expect(calls.find((call) => call.rpc === 'cage_cash_out')?.body).toEqual({
      p_venue_id: VENUE, p_member_id: 'm1', p_amount_paise: 3000000, p_to: 'wallet', p_idempotency_key: 'r1',
    });
  });

  it('says why a cash-out is refused', async () => {
    const { result } = renderCage({ cage_cash_out: { status: 400, body: { code: 'RVOUT', message: 'not checked in' } } });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.cashOut.mutateAsync({ memberId: 'm1', amount: fromPaise(1_000_000n), to: 'cash', requestId: 'r2' });
    });
    expect(outcome).toEqual({ ok: false, error: 'not_in_room' });
  });

  it('treats an empty answer as unavailable', async () => {
    const { result } = renderCage({ cage_cash_out: { body: [] } });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.cashOut.mutateAsync({ memberId: 'm1', amount: fromPaise(1_000_000n), to: 'cash', requestId: 'r3' });
    });
    expect(outcome).toEqual({ ok: false, error: 'unavailable' });
  });
});

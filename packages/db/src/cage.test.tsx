import { fromPaise } from '@rivr/domain/money';
import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useCageActions, useCageMembers } from './cage.ts';
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
  const { result } = renderHook(() => ({ actions: useCageActions(VENUE), members: useCageMembers(VENUE, 'Yash') }), { wrapper });
  return { result, calls };
}

afterEach(cleanup);

describe('Cage members', () => {
  it('gives the call time a member still owes, and whether an admin let them go early', async () => {
    const { result } = renderCage({ cage_members: { body: [{
      member_id: 'm1', full_name: 'Yash Gupta', tier_name: 'Member', is_kyc_complete: true, kyc_refusal: null, photo_path: null, wallet_paise: 0,
      bonus_paise: 0, markers_paise: 0, table_name: 'Private Room', seat: 1, minimum_paise: 1_000_000, break_until: null, call_time_owed_seconds: 5400,
      is_let_go_early: true,
    }] } });
    await waitFor(() => expect(result.current.members.data?.[0]).toMatchObject({ callTimeOwed: 5400, isLetGoEarly: true, kycRefusal: null }));
  });

  it('gives the reason a member\'s identity check failed (#58)', async () => {
    const { result } = renderCage({ cage_members: { body: [{
      member_id: 'm2', full_name: 'Naina Kapoor', tier_name: 'Member', is_kyc_complete: false, kyc_refusal: 'duplicate_pan', photo_path: null,
      wallet_paise: 0, bonus_paise: 0, markers_paise: 0, table_name: null, seat: null, minimum_paise: null, break_until: null,
      call_time_owed_seconds: 0, is_let_go_early: false,
    }] } });
    await waitFor(() => expect(result.current.members.data?.[0]).toMatchObject({ isKycComplete: false, kycRefusal: 'duplicate_pan' }));
  });
});

describe('Cash-out', () => {
  it('cashes out once per request id, to cash or the wallet, closing the visit when final, with the TDS withheld', async () => {
    const { result, calls } = renderCage({ cage_cash_out: { body: [{
      cage_transaction_id: 't1', markers_settled_paise: 1_000_000, to_member_paise: 1_400_000, tds_paise: 600_000, is_visit_closed: true,
    }] } });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.actions.cashOut.mutateAsync({ memberId: 'm1', amount: fromPaise(3_000_000n), to: 'wallet', isFinal: true, requestId: 'r1' });
    });
    expect(outcome).toEqual({ ok: true, value: { cageTransactionId: 't1', settled: 1_000_000n, toMember: 1_400_000n, tds: 600_000n, isVisitClosed: true } });
    expect(calls.find((call) => call.rpc === 'cage_cash_out')?.body).toEqual({
      p_venue_id: VENUE, p_member_id: 'm1', p_amount_paise: 3000000, p_to: 'wallet', p_idempotency_key: 'r1', p_is_final: true,
    });
  });

  it('says why a cash-out is refused', async () => {
    const { result } = renderCage({ cage_cash_out: { status: 400, body: { code: 'RVOUT', message: 'not checked in' } } });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.actions.cashOut.mutateAsync({ memberId: 'm1', amount: fromPaise(1_000_000n), to: 'cash', isFinal: false, requestId: 'r2' });
    });
    expect(outcome).toEqual({ ok: false, error: 'not_in_room' });
  });

  it.each([['RVAGE', 'under_age'], ['RVDUP', 'duplicate'], ['RVKYC', 'kyc_needed']])('refuses %s as %s (#58)', async (code, failure) => {
    const { result } = renderCage({ cage_cash_out: { status: 400, body: { code, message: 'identity' } } });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.actions.cashOut.mutateAsync({ memberId: 'm1', amount: fromPaise(1_000_000n), to: 'cash', isFinal: false, requestId: 'r4' });
    });
    expect(outcome).toEqual({ ok: false, error: failure });
  });

  it('treats an empty answer as unavailable', async () => {
    const { result } = renderCage({ cage_cash_out: { body: [] } });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.actions.cashOut.mutateAsync({ memberId: 'm1', amount: fromPaise(1_000_000n), to: 'cash', isFinal: false, requestId: 'r3' });
    });
    expect(outcome).toEqual({ ok: false, error: 'unavailable' });
  });
});

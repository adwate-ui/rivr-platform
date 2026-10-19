import { fromPaise } from '@rivr/domain/money';
import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { useSeatEvents, useTabletSeats } from './tabletSeats.ts';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const TABLET = '00000000-0000-4000-8000-00000000e001';

/** A fake API: each RPC answers with its reply; every call is kept with what it was sent. */
function renderTablet(replies: Record<string, { status?: number; body: unknown }>) {
  const calls: { rpc: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const rpc = (input instanceof Request ? input.url : String(input)).split('/rpc/')[1] ?? '';
    calls.push({ rpc, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const reply = replies[rpc];
    return Response.json(reply?.body ?? null, { status: reply?.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(TABLET), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({ seats: useTabletSeats(), events: useSeatEvents() }), { wrapper });
  return { result, calls };
}

afterEach(cleanup);

describe('The tablet\'s seats', () => {
  it('gives every seat: an open one, and a player away with a buy-in waiting at the cage', async () => {
    const { result } = renderTablet({ tablet_seats: { body: [
      { seat: 1, session_id: null, member_id: null, full_name: null, away_since: null, minimum_paise: 1000000, pending_buy_in_paise: null },
      { seat: 9, session_id: 's9', member_id: 'm9', full_name: 'Yash Gupta', away_since: '2026-10-19T18:00:00+00:00', minimum_paise: 1000000,
        pending_buy_in_paise: 2000000 },
    ] } });
    await waitFor(() => expect(result.current.seats.data).toEqual([
      { seat: 1, minimum: 1_000_000n, player: null },
      { seat: 9, minimum: 1_000_000n, player: { sessionId: 's9', fullName: 'Yash Gupta', isAway: true, pendingBuyIn: 2_000_000n } },
    ]));
  });

  it('asks the cage for a buy-in once per request id, and says when one is already waiting', async () => {
    const { result, calls } = renderTablet({ tablet_seats: { body: [] }, request_buy_in: { status: 400, body: { code: 'RVPND', message: 'waiting' } } });
    let outcome: unknown;
    await act(async () => { outcome = await result.current.events.requestBuyIn.mutateAsync({ sessionId: 's9', amount: fromPaise(1_000_000n), requestId: 'r1' }); });
    expect(outcome).toEqual({ ok: false, error: 'pending' });
    expect(calls.find((call) => call.rpc === 'request_buy_in')?.body).toEqual({ p_session_id: 's9', p_amount_paise: 1000000, p_idempotency_key: 'r1' });
  });

  it('marks a player away and lets one leave; a frozen venue is paused', async () => {
    const { result, calls } = renderTablet({ tablet_seats: { body: [] }, set_seat_away: { body: null }, end_seat: { status: 400, body: { code: 'RVFRZ', message: 'frozen' } } });
    let away: unknown;
    let left: unknown;
    await act(async () => { away = await result.current.events.setAway.mutateAsync({ sessionId: 's9', isAway: true }); });
    await act(async () => { left = await result.current.events.leave.mutateAsync('s9'); });
    expect(away).toEqual({ ok: true, value: null });
    expect(left).toEqual({ ok: false, error: 'paused' });
    expect(calls.find((call) => call.rpc === 'end_seat')?.body).toEqual({ p_session_id: 's9', p_reason: 'left' });
  });
});

import { createClient } from '@supabase/supabase-js';
import { onlineManager } from '@tanstack/react-query';
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
    const rpc = (input instanceof Request ? input.url : String(input)).split('/rpc/')[1]?.split('?')[0] ?? '';
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

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
});

describe('The tablet\'s seats', () => {
  it('gives every seat: an open one, and a player away with a buy-in waiting at the cage', async () => {
    const { result } = renderTablet({ tablet_seats: { body: [
      { seat: 1, session_id: null, member_id: null, full_name: null, away_since: null, minimum_paise: 1000000, leaving_at: null, small_blind_paise: 10000, big_blind_paise: 20000, straddle_paise: 50000 },
      { seat: 9, session_id: 's9', member_id: 'm9', full_name: 'Yash Gupta', away_since: '2026-10-19T18:00:00+00:00', minimum_paise: 1000000,
        leaving_at: '2026-10-19T18:05:00+00:00', small_blind_paise: 10000, big_blind_paise: 20000, straddle_paise: 50000 },
    ] } });
    await waitFor(() => expect(result.current.seats.data).toEqual([
      { seat: 1, minimum: 1_000_000n, smallBlind: 10_000n, bigBlind: 20_000n, straddle: 50_000n, player: null },
      { seat: 9, minimum: 1_000_000n, smallBlind: 10_000n, bigBlind: 20_000n, straddle: 50_000n, player: { sessionId: 's9', fullName: 'Yash Gupta', isAway: true, isLeaving: true, owesCallTime: false } },
    ]));
  });

  it('marks a player away and lets one leave; a frozen venue is paused', async () => {
    const { result, calls } = renderTablet({ tablet_seats: { body: [] }, set_seat_away: { body: null }, end_seat: { status: 400, body: { code: 'RVFRZ', message: 'frozen' } } });
    let away: unknown;
    let left: unknown;
    await act(async () => { away = await result.current.events.setAway.mutateAsync({ sessionId: 's9', isAway: true }); });
    await act(async () => { left = await result.current.events.leave.mutateAsync({ sessionId: 's9', reason: 'call_time_met' }); });
    expect(away).toEqual({ ok: true, value: null });
    expect(left).toEqual({ ok: false, error: 'paused' });
    // Every leave says why (#1060).
    expect(calls.find((call) => call.rpc === 'end_seat')?.body).toEqual({ p_session_id: 's9', p_reason: 'left', p_leave_reason: 'call_time_met' });
  });

  it('sends away and leaving even while the tablet thinks it is offline, so neither waits to go later', async () => {
    const unreachable = { status: 503, body: { message: 'unreachable' } };
    const { result, calls } = renderTablet({ tablet_seats: { body: [] }, set_seat_away: unreachable, end_seat: unreachable });
    // As on the tablet: the seats have loaded before the connection drops.
    await waitFor(() => expect(result.current.seats.data).toEqual([]));
    onlineManager.setOnline(false);
    const before = calls.length;
    const outcomes: unknown[] = [];
    await act(async () => { outcomes.push(await result.current.events.setAway.mutateAsync({ sessionId: 's9', isAway: true })); });
    await act(async () => { outcomes.push(await result.current.events.leave.mutateAsync({ sessionId: 's9', reason: 'busted' })); });
    expect(outcomes).toEqual([1, 2].map(() => ({ ok: false, error: 'unavailable' })));
    expect(calls.slice(before).map((call) => call.rpc)).toEqual(['set_seat_away', 'end_seat']);
  });
});

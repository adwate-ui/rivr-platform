import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useJackpot, useJackpotActions } from './jackpots.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const ADMIN = '00000000-0000-4000-8000-000000000103';
const VENUE = '00000000-0000-4000-8000-000000000001';

/** A fake API: each RPC, as `/rpc/pay_bad_beat`, answers with its reply; returns the requests made. */
function renderJackpot(replies: Record<string, { status?: number; body: unknown }>) {
  const calls: { path: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const path = new URL(input instanceof Request ? input.url : String(input)).pathname.replace('/rest/v1', '');
    calls.push({ path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const reply = replies[path];
    return Response.json(reply?.body ?? null, { status: reply?.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(ADMIN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({ jackpot: useJackpot(VENUE), actions: useJackpotActions(VENUE) }), { wrapper });
  return { result, calls };
}

const POOLS = [{ main_paise: 34260000, season_paise: 2000, freeroll_paise: 1000,
  payout_rule: { pool_basis_points: 10000, loser_basis_points: 5000, winner_basis_points: 2500, table_basis_points: 2500 } }];
const HISTORY = [{ event_id: 'e1', kind: 'payout', reverses_id: null, is_reversed: false, table_name: 'Table 3', loser_name: 'Arjun Mehta',
  winner_name: 'Kabir Sethi', others: 4, loser_paise: 17130000, winner_paise: 8565000, each_at_table_paise: 2140000, total_paise: 34255000,
  reason: null, created_at: '2026-10-19T16:30:00+00:00' }];
const READS = { '/rpc/jackpot_pools': { body: POOLS }, '/rpc/jackpot_history': { body: HISTORY } };

afterEach(cleanup);

describe('the jackpot on the console (#48)', () => {
  it('gives the pools in paise, the payout rule as @rivr/domain PayoutRule, and the history', async () => {
    const { result } = renderJackpot(READS);
    await waitFor(() => expect(result.current.jackpot.data).toBeDefined());
    expect(result.current.jackpot.data).toMatchObject({
      main: 34260000n, season: 2000n, freeroll: 1000n, rule: { poolShare: 10000n, loser: 5000n, winner: 2500n, table: 2500n },
    });
    expect(result.current.jackpot.data?.events[0]).toMatchObject({ eventId: 'e1', kind: 'payout', loserName: 'Arjun Mehta', total: 34255000n, isReversed: false });
  });

  it('gives no rule when none is set', async () => {
    const { result } = renderJackpot({ ...READS, '/rpc/jackpot_pools': { body: [{ ...POOLS[0], payout_rule: null }] } });
    await waitFor(() => expect(result.current.jackpot.data).toBeDefined());
    expect(result.current.jackpot.data?.rule).toBeNull();
  });

  it('pays a bad beat with its request id, and says why one is refused', async () => {
    const paid = renderJackpot({ ...READS, '/rpc/pay_bad_beat': { body: 'e2' } });
    const beat = { tableId: 't3', loserPhone: '+919000000201', winnerPhone: '+919000000202', otherPhones: ['+919000000203'], requestId: 'r-1' };
    let outcome: unknown;
    await act(async () => { outcome = await paid.result.current.actions.pay.mutateAsync(beat); });
    expect(outcome).toEqual({ ok: true, value: 'e2' });
    expect(paid.calls.find((call) => call.path === '/rpc/pay_bad_beat')?.body).toEqual({
      p_venue_id: VENUE, p_table_id: 't3', p_loser_phone: '+919000000201', p_winner_phone: '+919000000202',
      p_table_phones: ['+919000000203'], p_idempotency_key: 'r-1',
    });
    cleanup();
    const stranger = renderJackpot({ ...READS, '/rpc/pay_bad_beat': { status: 400, body: { code: 'RVNMB', message: 'not a member' } } });
    await act(async () => { outcome = await stranger.result.current.actions.pay.mutateAsync(beat); });
    expect(outcome).toEqual({ ok: false, error: 'not_member' });
  });

  it('reverses a payout once', async () => {
    const twice = renderJackpot({ ...READS, '/rpc/reverse_jackpot_event': { status: 400, body: { code: 'RVDUP', message: 'reversed' } } });
    let outcome: unknown;
    await act(async () => { outcome = await twice.result.current.actions.reverse.mutateAsync({ eventId: 'e1', reason: 'Wrong table', requestId: 'r-2' }); });
    expect(outcome).toEqual({ ok: false, error: 'already_reversed' });
  });
});

import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';
import { useWaitlistCallActions } from './waitlistCalls.ts';

/** A fake API: each path answers with its reply; every call is kept with what it sent. */
function renderCalls(replies: Record<string, { status?: number; body: unknown }>) {
  const calls: { url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const path = Object.keys(replies).find((key) => url.includes(key));
    const reply = path ? replies[path] : undefined;
    return reply === undefined ? new Response(null, { status: 204 }) : Response.json(reply.body, { status: reply.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor('00000000-0000-4000-8000-000000000103'), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => useWaitlistCallActions(), { wrapper });
  return { result, calls };
}

const bodyOf = (calls: { url: string; body: unknown }[], path: string) => calls.find((call) => call.url.includes(path))?.body;

afterEach(cleanup);

describe('the floor\u2019s call-down (#63)', () => {
  it('assigns a waiting member a table, seat and call time, seats a called one, and holds a place and brings it back', async () => {
    const { result, calls } = renderCalls({});
    let outcome: unknown;
    await act(async () => { outcome = await result.current.assign.mutateAsync({ entryId: 'e1', tableId: 't3', seat: 9, callMinutes: 240 }); });
    expect(outcome).toEqual({ ok: true, value: null });
    expect(bodyOf(calls, '/rpc/assign_from_waitlist')).toEqual({ p_entry_id: 'e1', p_table_id: 't3', p_seat: 9, p_call_minutes: 240 });
    await act(async () => { outcome = await result.current.seat.mutateAsync('e1'); });
    expect(outcome).toEqual({ ok: true, value: null });
    expect(bodyOf(calls, '/rpc/seat_from_waitlist')).toEqual({ p_entry_id: 'e1' });
    await act(async () => { await result.current.away.mutateAsync({ entryId: 'e1', isAway: true }); });
    await act(async () => { await result.current.away.mutateAsync({ entryId: 'e1', isAway: false }); });
    expect(calls.filter((call) => call.url.includes('/rpc/step_away')).map((call) => call.body)).toEqual([
      { p_entry_id: 'e1', p_is_away: true }, { p_entry_id: 'e1', p_is_away: false },
    ]);
  });

  it('says why an assignment did not go through, as the waitlist says it: a frozen venue is paused', async () => {
    const { result } = renderCalls({ '/rpc/assign_from_waitlist': { status: 400, body: { code: 'RVFRZ', message: 'frozen' } } });
    let outcome: unknown;
    await act(async () => { outcome = await result.current.assign.mutateAsync({ entryId: 'e1', tableId: 't3', seat: 9, callMinutes: 180 }); });
    expect(outcome).toEqual({ ok: false, error: 'paused' });
  });

  it('assigns with bonus chips the member redeems (decision 0504), and says when they have too few', async () => {
    const { result, calls } = renderCalls({});
    await act(async () => { await result.current.assign.mutateAsync({ entryId: 'e1', tableId: 't3', seat: 9, callMinutes: 240, bonusChips: 500 }); });
    expect(bodyOf(calls, '/rpc/assign_from_waitlist')).toEqual({ p_entry_id: 'e1', p_table_id: 't3', p_seat: 9, p_call_minutes: 240, p_bonus_chips: 500 });
    cleanup();
    const refused = renderCalls({ '/rpc/assign_from_waitlist': { status: 400, body: { code: 'RVBON', message: 'short' } } });
    let outcome: unknown;
    await act(async () => { outcome = await refused.result.current.assign.mutateAsync({ entryId: 'e1', tableId: 't3', seat: 9, callMinutes: 180, bonusChips: 5000 }); });
    expect(outcome).toEqual({ ok: false, error: 'bonus_short' });
  });
});

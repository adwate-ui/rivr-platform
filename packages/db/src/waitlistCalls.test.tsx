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
  it('calls a waiting member to a table and seat, seats them there, and steps a place away and back', async () => {
    const { result, calls } = renderCalls({});
    let outcome: unknown;
    await act(async () => { outcome = await result.current.call.mutateAsync({ entryId: 'e1', tableId: 't3', seat: 9 }); });
    expect(outcome).toEqual({ ok: true, value: null });
    expect(bodyOf(calls, '/rpc/call_from_waitlist')).toEqual({ p_entry_id: 'e1', p_table_id: 't3', p_seat: 9 });
    await act(async () => { outcome = await result.current.seat.mutateAsync('e1'); });
    expect(outcome).toEqual({ ok: true, value: null });
    expect(bodyOf(calls, '/rpc/seat_from_waitlist')).toEqual({ p_entry_id: 'e1' });
    await act(async () => { await result.current.away.mutateAsync({ entryId: 'e1', isAway: true }); });
    await act(async () => { await result.current.away.mutateAsync({ entryId: 'e1', isAway: false }); });
    expect(calls.filter((call) => call.url.includes('/rpc/step_away')).map((call) => call.body)).toEqual([
      { p_entry_id: 'e1', p_is_away: true }, { p_entry_id: 'e1', p_is_away: false },
    ]);
  });

  it('says why a call did not go through, as the waitlist says it: a frozen venue is paused', async () => {
    const { result } = renderCalls({ '/rpc/call_from_waitlist': { status: 400, body: { code: 'RVFRZ', message: 'frozen' } } });
    let outcome: unknown;
    await act(async () => { outcome = await result.current.call.mutateAsync({ entryId: 'e1', tableId: 't3', seat: 9 }); });
    expect(outcome).toEqual({ ok: false, error: 'paused' });
  });
});

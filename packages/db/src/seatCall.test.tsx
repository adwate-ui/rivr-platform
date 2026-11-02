import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { useFloorTakenSeats, useSeatCallActions } from './seatCall.ts';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const SIGNED_IN = '00000000-0000-4000-8000-000000000211';

/** A fake API: each RPC answers with its reply; every call is kept with what it was sent. */
function renderTonight(replies: Record<string, { status?: number; body: unknown }>) {
  const calls: { rpc: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const rpc = (input instanceof Request ? input.url : String(input)).split('/rpc/')[1] ?? '';
    calls.push({ rpc, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const reply = replies[rpc];
    return Response.json(reply?.body ?? [], { status: reply?.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(SIGNED_IN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({ taken: useFloorTakenSeats(), actions: useSeatCallActions() }), { wrapper });
  return { result, calls };
}

afterEach(cleanup);

describe('Tonight\'s seat map and seat call (decisions 0320, 0321)', () => {
  it('groups the taken seat numbers by table', async () => {
    const { result } = renderTonight({
      floor_taken_seats: { body: [{ table_id: 't1', seat: 2 }, { table_id: 't1', seat: 5 }, { table_id: 't3', seat: 9 }] },
    });
    await waitFor(() => expect(result.current.taken.data).toEqual(new Map([['t1', [2, 5]], ['t3', [9]]])));
  });

  it('says the member is on their way, and reads a refusal as its failure', async () => {
    const { result, calls } = renderTonight({ accept_seat_call: { status: 400, body: { code: '22023', message: 'No seat is held for you' } } });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.actions.acceptCall.mutateAsync('e1');
    });
    expect(calls.find((call) => call.rpc === 'accept_seat_call')?.body).toEqual({ p_entry_id: 'e1' });
    expect(outcome).toEqual({ ok: false, error: 'invalid' });
  });
});

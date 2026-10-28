import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useHostQueue, useHostQueueActions } from './hostQueue.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const ADITYA = '00000000-0000-4000-8000-000000000103';
const ROW = {
  item_id: 'h1', member_id: 'm1', full_name: 'Lata Iyer', phone: '+919000000881', last_visit_at: '2026-09-28T19:00:00+00:00', visits: 4,
  status: 'offered', churn_reason: 'busy', offer: { kind: 'points', points: 500 }, note: 'Call back on Friday', handled_at: '2026-10-28T10:00:00+00:00',
};

/** A fake API: the queue answers with its rows; a call is kept, or refused with the given code. */
function renderQueue(refusal: string | null = null) {
  const calls: { url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (url.includes('/rpc/host_queue')) return Response.json([ROW, { ...ROW, item_id: 'h2', status: 'open', churn_reason: null, offer: { kind: 'cash' }, note: null }]);
    return refusal === null ? new Response(null, { status: 204 }) : Response.json({ code: refusal, message: 'no' }, { status: 400 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(ADITYA), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({ queue: useHostQueue('v1'), actions: useHostQueueActions('v1') }), { wrapper });
  return { result, calls };
}

afterEach(cleanup);

describe('the host queue', () => {
  it('gives the lapsed regulars with the call so far, an offer only when it is a promotion effect', async () => {
    const { result } = renderQueue();
    await waitFor(() => expect(result.current.queue.data).toHaveLength(2));
    expect(result.current.queue.data?.[0]).toMatchObject({ fullName: 'Lata Iyer', status: 'offered', reason: 'busy', offer: { kind: 'points', points: 500 } });
    expect(result.current.queue.data?.[1]).toMatchObject({ status: 'open', reason: null, offer: null });
  });

  it('records a call and closes an item', async () => {
    const { result, calls } = renderQueue();
    const contact = { reason: 'busy' as const, offer: { kind: 'spin' as const }, note: null };
    expect(await act(() => result.current.actions.record.mutateAsync({ itemId: 'h1', contact }))).toEqual({ ok: true, value: null });
    expect(await act(() => result.current.actions.close.mutateAsync('h1'))).toEqual({ ok: true, value: null });
    expect(calls.find((call) => call.url.includes('/rpc/record_host_contact'))?.body)
      .toEqual({ p_item_id: 'h1', p_churn_reason: 'busy', p_offer: { kind: 'spin' } });
  });

  it('says why a call was not kept', async () => {
    const { result } = renderQueue('RVHST');
    const contact = { reason: 'busy' as const, offer: null, note: null };
    expect(await act(() => result.current.actions.record.mutateAsync({ itemId: 'h1', contact }))).toEqual({ ok: false, error: 'gone' });
  });
});

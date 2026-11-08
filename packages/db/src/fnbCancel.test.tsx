import { createClient } from '@supabase/supabase-js';
import { QueryClient } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useCancelMyFnbOrder } from './fnbCancel.ts';
import { useAuthStatus, RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

/** A fake API that answers the cancel with `reply`, and keeps what was sent. */
function clientFor(reply: { status: number; body?: unknown }) {
  const sent: unknown[] = [];
  const fetch: typeof globalThis.fetch = async (_input, init) => {
    sent.push(JSON.parse(String(init?.body)));
    return reply.body === undefined ? new Response(null, { status: reply.status }) : Response.json(reply.body, { status: reply.status });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor('00000000-0000-4000-8000-0000000d0713'), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client} queryClient={queryClient}>{children}</RivrDataProvider>;
  return { wrapper, sent };
}

afterEach(cleanup);

/** Cancels the order once the session is read. */
async function cancelWith(reply: { status: number; body?: unknown }) {
  const { wrapper, sent } = clientFor(reply);
  const { result } = renderHook(() => ({ auth: useAuthStatus(), cancel: useCancelMyFnbOrder() }), { wrapper });
  await waitFor(() => expect(result.current.auth).toBe('signed-in'));
  let outcome: unknown;
  await act(async () => { outcome = await result.current.cancel.mutateAsync('o1'); });
  return { outcome, sent };
}

describe('a member cancelling their order (F-048)', () => {
  it('asks for that order, and is done', async () => {
    const { outcome, sent } = await cancelWith({ status: 204 });
    expect(outcome).toEqual({ ok: true, value: null });
    expect(sent).toEqual([{ p_order_id: 'o1' }]);
  });

  it('says so when the bar accepted it first', async () => {
    expect((await cancelWith({ status: 400, body: { code: '22023', message: 'The bar has accepted that order' } })).outcome).toEqual({ ok: false, error: 'accepted' });
  });

  it('says it did not go through on anything else', async () => {
    expect((await cancelWith({ status: 500, body: { code: 'XX000', message: 'down' } })).outcome).toEqual({ ok: false, error: 'unavailable' });
  });
});

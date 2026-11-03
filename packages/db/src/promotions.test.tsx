import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { usePromotionActions, usePromotionStakes } from './promotions.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const SIGNED_IN = '00000000-0000-4000-8000-000000000107';
const VENUE = '00000000-0000-4000-8000-000000000001';

/** A fake API: each path answers with its reply; the calls are kept. */
function renderPromotions(replies: Record<string, { status?: number; body: unknown }>) {
  const calls: { url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const path = Object.keys(replies).find((key) => url.includes(key));
    const reply = path ? replies[path] : undefined;
    return Response.json(reply?.body ?? null, { status: reply?.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(SIGNED_IN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({ stakes: usePromotionStakes(VENUE), actions: usePromotionActions(VENUE) }), { wrapper });
  return { result, calls };
}

afterEach(cleanup);

describe('Promotions run by a rule, and the builder stakes', () => {
  it('lists the stakes the builder offers, lowest blinds first', async () => {
    const { result, calls } = renderPromotions({ '/rest/v1/table_type': { body: [{ code: 'nlh_100_200', name: 'NLH 100/200' }] } });
    await waitFor(() => expect(result.current.stakes.data).toEqual([{ code: 'nlh_100_200', name: 'NLH 100/200' }]));
    expect(calls.find((call) => call.url.includes('/rest/v1/table_type'))?.url).toContain('order=small_blind_paise');
  });

  it('pauses and resumes a card through set_promotion_live, saying why one is refused', async () => {
    const { result, calls } = renderPromotions({ '/rpc/set_promotion_live': { status: 400, body: { code: 'RVKIL', message: 'off', details: null, hint: null } } });
    let refused: unknown;
    await act(async () => {
      refused = await result.current.actions.setLive.mutateAsync({ id: 'p9', isLive: false });
    });
    expect(refused).toEqual({ ok: false, error: 'switched_off' });
    expect(calls.find((call) => call.url.includes('set_promotion_live'))?.body).toEqual({ p_promotion_id: 'p9', p_is_live: false });
  });

  it('resumes one, and says so', async () => {
    const { result } = renderPromotions({ '/rpc/set_promotion_live': { body: null } });
    let resumed: unknown;
    await act(async () => {
      resumed = await result.current.actions.setLive.mutateAsync({ id: 'p9', isLive: true });
    });
    expect(resumed).toEqual({ ok: true, value: null });
  });
});

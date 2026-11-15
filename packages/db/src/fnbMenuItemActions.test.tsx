import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useFnbMenuItemActions } from './fnbMenuFile.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const SIGNED_IN = '00000000-0000-4000-8000-000000000103';
const VENUE = '00000000-0000-4000-8000-000000000001';
const CHAI = '00000000-0000-4000-8000-0000000000c1';

/** A fake API that answers each call named in `replies`, and what it was sent. */
function renderActions(replies: Record<string, { status?: number; body: unknown }>) {
  const sent: { rpc: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    const rpc = Object.keys(replies).find((name) => url.includes(`/rpc/${name}`));
    if (rpc === undefined) return Response.json([]);
    sent.push({ rpc, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return Response.json(replies[rpc]?.body ?? null, { status: replies[rpc]?.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(SIGNED_IN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => useFnbMenuItemActions(VENUE), { wrapper });
  return { result, sent };
}

afterEach(cleanup);

describe('an item of the menu (redesign RD-33)', () => {
  it('is hidden or shown again by its id', async () => {
    const { result, sent } = renderActions({ set_fnb_item_available: { body: null } });
    let hidden: unknown;
    await act(async () => { hidden = await result.current.setItemAvailable.mutateAsync({ itemId: CHAI, isAvailable: false }); });
    expect(hidden).toEqual({ ok: true, value: null });
    expect(sent).toEqual([{ rpc: 'set_fnb_item_available', body: { p_item_id: CHAI, p_is_available: false } }]);
  });

  it('is deleted by its id', async () => {
    const { result, sent } = renderActions({ delete_fnb_item: { body: null } });
    let deleted: unknown;
    await act(async () => { deleted = await result.current.deleteItem.mutateAsync(CHAI); });
    expect(deleted).toEqual({ ok: true, value: null });
    expect(sent).toEqual([{ rpc: 'delete_fnb_item', body: { p_item_id: CHAI } }]);
  });

  it.each([
    ['42501', 'not_allowed'],
    ['RVFRZ', 'paused'],
    ['22023', 'invalid'],
    ['XX000', 'unavailable'],
  ])('says why when the database refuses with %s', async (code, failure) => {
    const { result } = renderActions({ delete_fnb_item: { status: 400, body: { code, message: 'no' } } });
    let deleted: unknown;
    await act(async () => { deleted = await result.current.deleteItem.mutateAsync(CHAI); });
    expect(deleted).toEqual({ ok: false, error: failure });
  });
});

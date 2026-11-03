import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useSaveFnbMenu } from './fnbMenuFile.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const SIGNED_IN = '00000000-0000-4000-8000-000000000103';
const VENUE = '00000000-0000-4000-8000-000000000001';

/** A fake API that answers save_fnb_menu with `reply`, and the bodies it was sent. */
function renderSave(reply: { status?: number; body: unknown }) {
  const sent: unknown[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!url.includes('/rpc/save_fnb_menu')) return Response.json([]);
    sent.push(init?.body ? JSON.parse(String(init.body)) : undefined);
    return Response.json(reply.body, { status: reply.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(SIGNED_IN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => useSaveFnbMenu(VENUE), { wrapper });
  return { result, sent };
}

const ITEMS = [{ name: ' Club sandwich ', kind: 'food', isAvailable: null }, { name: 'Beer', kind: 'alcohol', isAvailable: false }] as const;

afterEach(cleanup);

describe('the menu from a file', () => {
  it('saves every item in one go, named without spaces around them, on offer unsaid where the file is silent, and says how many', async () => {
    const { result, sent } = renderSave({ body: 2 });
    let saved: unknown;
    await act(async () => { saved = await result.current.mutateAsync(ITEMS); });
    expect(saved).toEqual({ ok: true, value: 2 });
    expect(sent).toEqual([{
      p_venue_id: VENUE,
      p_items: [{ name: 'Club sandwich', kind: 'food', is_available: null }, { name: 'Beer', kind: 'alcohol', is_available: false }],
    }]);
  });

  it('says why the menu was not saved', async () => {
    for (const [code, failure] of [['22023', 'invalid'], ['42501', 'not_allowed'], ['RVFRZ', 'paused'], ['XX000', 'unavailable']]) {
      const { result } = renderSave({ status: 400, body: { code, message: 'no' } });
      let saved: unknown;
      await act(async () => { saved = await result.current.mutateAsync(ITEMS); });
      expect(saved).toEqual({ ok: false, error: failure });
    }
  });
});

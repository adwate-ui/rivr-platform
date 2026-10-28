import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { usePushSubscriptionActions } from './push.ts';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const KABIR = '00000000-0000-4000-8000-000000000202';
const phone = { endpoint: 'https://fcm.googleapis.com/fcm/send/kabir', keys: { p256dh: 'BKabirP256dhKeyAAAAAAAAAAAA', auth: 'kabirAuth123' } };

/** A fake API whose functions answer 204, or 500 when told to fail. */
function renderActions(status = 204) {
  const calls: { url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return status === 204 ? new Response(null, { status }) : Response.json({ message: 'down' }, { status });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(KABIR), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => usePushSubscriptionActions(), { wrapper });
  return { result, calls: () => calls.filter((call) => call.url.includes('/rest/v1/rpc/')) };
}

afterEach(cleanup);

describe('usePushSubscriptionActions', () => {
  it('saves the phone\u2019s push address and keys, and removes it by its address', async () => {
    const { result, calls } = renderActions();
    expect(await act(() => result.current.save.mutateAsync(phone))).toEqual({ ok: true, value: null });
    expect(await act(() => result.current.remove.mutateAsync(phone.endpoint))).toEqual({ ok: true, value: null });
    expect(calls()).toEqual([
      { url: 'http://127.0.0.1:9/rest/v1/rpc/save_push_subscription', body: { p_endpoint: phone.endpoint, p_p256dh: phone.keys.p256dh, p_auth: phone.keys.auth } },
      { url: 'http://127.0.0.1:9/rest/v1/rpc/remove_push_subscription', body: { p_endpoint: phone.endpoint } },
    ]);
  });

  it('is unavailable when the database cannot be reached', async () => {
    const { result } = renderActions(500);
    expect(await act(() => result.current.save.mutateAsync(phone))).toEqual({ ok: false, error: 'unavailable' });
  });
});

import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useLiveStatusDeviceActions } from './liveStatus.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const ISHAAN = '00000000-0000-4000-8000-000000000211';
const TOKEN = 'dXk3:APA91bHPRgkF3JUikC4ENAHEeMrd41Zxv';
const KEY = 'f0'.repeat(32);

/** A fake API whose functions answer with `reply`, or fail with `status`. */
function renderActions({ status = 200, reply = KEY }: { status?: number; reply?: unknown } = {}) {
  const calls: { url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (status >= 400) return Response.json({ message: 'down' }, { status });
    return url.endsWith('save_live_status_device') ? Response.json(reply) : new Response(null, { status: 204 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(ISHAAN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => useLiveStatusDeviceActions(), { wrapper });
  return { result, calls: () => calls.filter((call) => call.url.includes('/rest/v1/rpc/')) };
}

afterEach(cleanup);

describe('useLiveStatusDeviceActions', () => {
  it('saves an iPhone with its alert token', async () => {
    const { result, calls } = renderActions();
    const apple = 'a1'.repeat(32);
    await act(() => result.current.save.mutateAsync({ platform: 'ios', token: apple, alertToken: 'b2'.repeat(32), deviceKey: null }));
    expect(calls()).toEqual([
      { url: 'http://127.0.0.1:9/rest/v1/rpc/save_live_status_device', body: { p_platform: 'ios', p_token: apple, p_alert_token: 'b2'.repeat(32) } },
    ]);
  });

  it('saves the phone with the key it kept, gives back its new key, and removes it by its token', async () => {
    const { result, calls } = renderActions();

    expect(await act(() => result.current.save.mutateAsync({ platform: 'android', token: TOKEN, deviceKey: 'e1'.repeat(32) }))).toEqual({ ok: true, value: KEY });
    expect(await act(() => result.current.remove.mutateAsync(TOKEN))).toEqual({ ok: true, value: null });
    expect(calls()).toEqual([
      { url: 'http://127.0.0.1:9/rest/v1/rpc/save_live_status_device', body: { p_platform: 'android', p_token: TOKEN, p_device_key: 'e1'.repeat(32) } },
      { url: 'http://127.0.0.1:9/rest/v1/rpc/remove_live_status_device', body: { p_token: TOKEN } },
    ]);
  });

  it('saves a phone that kept no key yet without one', async () => {
    const { result, calls } = renderActions();

    await act(() => result.current.save.mutateAsync({ platform: 'ios', token: 'a1'.repeat(32), deviceKey: null }));

    expect(calls()[0]?.body).toEqual({ p_platform: 'ios', p_token: 'a1'.repeat(32) });
  });

  it('says when the database could not save or remove it, or answered with no key', async () => {
    const failing = renderActions({ status: 500 });
    expect(await act(() => failing.result.current.save.mutateAsync({ platform: 'android', token: TOKEN, deviceKey: null }))).toEqual({ ok: false, error: 'unavailable' });
    expect(await act(() => failing.result.current.remove.mutateAsync(TOKEN))).toEqual({ ok: false, error: 'unavailable' });

    const keyless = renderActions({ reply: null });
    expect(await act(() => keyless.result.current.save.mutateAsync({ platform: 'android', token: TOKEN, deviceKey: null }))).toEqual({ ok: false, error: 'unavailable' });
  });
});

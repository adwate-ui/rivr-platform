import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { rememberAttribution, storedAttribution } from './attribution.ts';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { useSignUp } from './signUp.ts';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const NEW_USER = '00000000-0000-4000-8000-0000000000a1';

/** A fake API whose sign_up answers with `reply`. */
function renderSignUp(reply: { status: number; body: unknown }) {
  const calls: { url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return Response.json(reply.body, { status: reply.status });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(NEW_USER), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => useSignUp(), { wrapper });
  return { result, calls };
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('useSignUp', () => {
  it('signs up with the name and the codes the player arrived with, then forgets the codes', async () => {
    rememberAttribution('?ref=FRIEND1&utm_source=instagram');
    const attribution = storedAttribution();
    const { result, calls } = renderSignUp({ status: 200, body: NEW_USER });

    expect(await act(() => result.current.mutateAsync({ fullName: 'Tara Joshi' }))).toEqual({ ok: true, value: null });
    expect(calls.find((call) => call.url.includes('/rpc/sign_up'))?.body).toEqual({ p_full_name: 'Tara Joshi', p_attribution: attribution });
    expect(attribution).toMatchObject({ referral: 'FRIEND1', utmSource: 'instagram' });
    expect(storedAttribution()).toBeNull();
  });

  it('says when the name was refused or sign-up is switched off', async () => {
    const refused = renderSignUp({ status: 400, body: { code: '22023', message: 'A full name is needed' } });
    expect(await act(() => refused.result.current.mutateAsync({ fullName: 'X' }))).toEqual({ ok: false, error: 'invalid_name' });

    const stopped = renderSignUp({ status: 400, body: { code: 'RVKIL', message: 'feature_switched_off: kyc_signup' } });
    expect(await act(() => stopped.result.current.mutateAsync({ fullName: 'Tara Joshi' }))).toEqual({ ok: false, error: 'stopped' });
  });
});

import { indianMobileSchema, ok } from '@rivr/contracts';
import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useFeature } from './hooks.ts';
import { RivrDataProvider } from './provider.tsx';
import { useSignIn, type SignInResult } from './signIn.ts';

const phone = indianMobileSchema.parse('+919000000201');

interface Reply {
  status: number;
  body: unknown;
  /** Answer this long after the request, as a slow network would. */
  delayMs?: number;
}

/**
 * A fake Auth and PostgREST: answers each path with the reply a test sets (or works out when
 * asked), and records the calls.
 */
function fakeApi(replies: Record<string, Reply | (() => Reply)>) {
  const calls: { path: string; query: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const { pathname: path, search: query } = new URL(input instanceof Request ? input.url : String(input));
    calls.push({ path, query, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const set = replies[path] ?? { status: 404, body: {} };
    const reply = typeof set === 'function' ? set() : set;
    if (reply.delayMs) await new Promise((resolve) => setTimeout(resolve, reply.delayMs));
    return new Response(reply.status === 204 ? null : JSON.stringify(reply.body), {
      status: reply.status,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { fetch, calls };
}

// The second hand-built session in db's tests (provider.test.tsx has the first); a factory in
// @rivr/testing comes with the third (CLAUDE.md rule 7).
const session = {
  access_token: 'access',
  refresh_token: 'refresh',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: '00000000-0000-4000-8000-000000000201', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
};

/** Renders useSignIn, plus whatever else a screen would have mounted while signing in. */
function signInWith(replies: Record<string, Reply | (() => Reply)>, useAlsoOnScreen: () => unknown = () => null) {
  const api = fakeApi(replies);
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch: api.fetch },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({ ...useSignIn(), onScreen: useAlsoOnScreen() }), { wrapper });
  return { result, calls: api.calls };
}

afterEach(cleanup);

describe('useSignIn', () => {
  it('asks Auth for a code for the number', async () => {
    const { result, calls } = signInWith({ '/auth/v1/otp': { status: 200, body: {} } });

    const sent = await act(() => result.current.requestCode.mutateAsync({ phone }));

    expect(sent).toEqual({ ok: true, value: null });
    expect(calls[0]).toMatchObject({ path: '/auth/v1/otp', body: { phone } });
  });

  it('says to wait when Auth refuses a second code inside the minute', async () => {
    const { result } = signInWith({ '/auth/v1/otp': { status: 429, body: { code: 429, error_code: 'over_sms_send_rate_limit', msg: 'after 59 seconds' } } });

    expect(await act(() => result.current.requestCode.mutateAsync({ phone }))).toEqual({ ok: false, error: 'too_many_requests' });
  });

  it('rejects a wrong or expired code and links nothing', async () => {
    const { result, calls } = signInWith({ '/auth/v1/verify': { status: 403, body: { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' } } });

    expect(await act(() => result.current.verifyCode.mutateAsync({ phone, code: '000000' }))).toEqual({ ok: false, error: 'code_rejected' });
    expect(calls.map((call) => call.path)).not.toContain('/rest/v1/rpc/link_my_login');
  });

  it('signs in with the right SMS code, then links the records registered under the number', async () => {
    const { result, calls } = signInWith({
      '/auth/v1/verify': { status: 200, body: session },
      '/rest/v1/rpc/link_my_login': { status: 204, body: null },
    });

    expect(await act(() => result.current.verifyCode.mutateAsync({ phone, code: '123456' }))).toEqual({ ok: true, value: null });
    expect(calls[0]).toMatchObject({ path: '/auth/v1/verify', body: { phone, token: '123456', type: 'sms' } });
    expect(calls[1]?.path).toBe('/rest/v1/rpc/link_my_login');
  });

  it('asks again what the person may see once the records are linked', async () => {
    let linked = false;
    const { result, calls } = signInWith(
      {
        '/auth/v1/verify': { status: 200, body: session },
        '/rest/v1/rpc/link_my_login': () => {
          setTimeout(() => (linked = true), 90); // linked just before the slow answer arrives
          return { status: 204, body: null, delayMs: 100 };
        },
        // Before linking the database knows no member for this login, so it returns no features.
        '/rest/v1/rpc/my_feature_access': () => ({
          status: 200,
          body: linked ? [{ feature_key: 'learn.library', state: 'enabled', tiers: null }] : [],
        }),
      },
      () => useFeature('learn.library'),
    );

    // Not awaited inside act: the screen re-renders as soon as Auth reports the sign-in, as it does in the app.
    let verified: Promise<SignInResult> = Promise.resolve(ok(null));
    act(() => {
      verified = result.current.verifyCode.mutateAsync({ phone, code: '123456' });
    });
    await waitFor(() => expect(calls.map((call) => call.path)).toContain('/rest/v1/rpc/my_feature_access'));
    expect(await act(() => verified)).toEqual({ ok: true, value: null });

    // A slow runner can take over a second for the sign-in, the link and the refetch.
    await waitFor(() => expect(result.current.onScreen).toEqual({ state: 'enabled' }), { timeout: 5000 });
  });

  it('signs out again on this device only if the records cannot be linked, so nobody is left signed in as no one', async () => {
    const { result, calls } = signInWith({
      '/auth/v1/verify': { status: 200, body: session },
      '/rest/v1/rpc/link_my_login': { status: 500, body: { message: 'down' } },
      '/auth/v1/logout': { status: 204, body: null },
    });

    expect(await act(() => result.current.verifyCode.mutateAsync({ phone, code: '123456' }))).toEqual({ ok: false, error: 'unavailable' });
    expect(calls.find((call) => call.path === '/auth/v1/logout')?.query).toBe('?scope=local');
  });
});

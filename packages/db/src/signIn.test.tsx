import { indianMobileSchema } from '@rivr/contracts';
import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { useSignIn } from './signIn.ts';

const phone = indianMobileSchema.parse('+919000000201');

interface Reply {
  status: number;
  body: unknown;
}

/** A fake Auth and PostgREST: answers each path with the reply a test sets, and records the calls. */
function fakeApi(replies: Record<string, Reply>) {
  const calls: { path: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const path = new URL(input instanceof Request ? input.url : String(input)).pathname;
    calls.push({ path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const reply = replies[path] ?? { status: 404, body: {} };
    return new Response(reply.status === 204 ? null : JSON.stringify(reply.body), {
      status: reply.status,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { fetch, calls };
}

const session = {
  access_token: 'access',
  refresh_token: 'refresh',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: '00000000-0000-4000-8000-000000000201', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
};

function signInWith(replies: Record<string, Reply>) {
  const api = fakeApi(replies);
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch: api.fetch },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => useSignIn(), { wrapper });
  return { result, calls: api.calls };
}

afterEach(cleanup);

describe('useSignIn', () => {
  it('asks Auth for a code for the number, in the member’s language', async () => {
    const { result, calls } = signInWith({ '/auth/v1/otp': { status: 200, body: {} } });

    const sent = await act(() => result.current.requestCode.mutateAsync({ phone, language: 'hi' }));

    expect(sent).toEqual({ ok: true, value: null });
    expect(calls[0]).toMatchObject({ path: '/auth/v1/otp', body: { phone, data: { language: 'hi' } } });
  });

  it('says to wait when Auth refuses a second code inside the minute', async () => {
    const { result } = signInWith({ '/auth/v1/otp': { status: 429, body: { code: 429, error_code: 'over_sms_send_rate_limit', msg: 'after 59 seconds' } } });

    expect(await act(() => result.current.requestCode.mutateAsync({ phone, language: 'en' }))).toEqual({ ok: false, error: 'too_many_requests' });
  });

  it('rejects a wrong or expired code and links nothing', async () => {
    const { result, calls } = signInWith({ '/auth/v1/verify': { status: 403, body: { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' } } });

    expect(await act(() => result.current.verifyCode.mutateAsync({ phone, code: '000000' }))).toEqual({ ok: false, error: 'code_rejected' });
    expect(calls.map((call) => call.path)).not.toContain('/rest/v1/rpc/link_my_login');
  });

  it('signs in with the right code, then links the records registered under the number', async () => {
    const { result, calls } = signInWith({
      '/auth/v1/verify': { status: 200, body: session },
      '/rest/v1/rpc/link_my_login': { status: 204, body: null },
    });

    expect(await act(() => result.current.verifyCode.mutateAsync({ phone, code: '123456' }))).toEqual({ ok: true, value: null });
    expect(calls.map((call) => call.path)).toEqual(['/auth/v1/verify', '/rest/v1/rpc/link_my_login']);
  });

  it('signs out again if the records cannot be linked, so nobody is left signed in as no one', async () => {
    const { result, calls } = signInWith({
      '/auth/v1/verify': { status: 200, body: session },
      '/rest/v1/rpc/link_my_login': { status: 500, body: { message: 'down' } },
      '/auth/v1/logout': { status: 204, body: null },
    });

    expect(await act(() => result.current.verifyCode.mutateAsync({ phone, code: '123456' }))).toEqual({ ok: false, error: 'unavailable' });
    expect(calls.map((call) => call.path)).toContain('/auth/v1/logout');
  });
});

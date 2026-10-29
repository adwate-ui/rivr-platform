import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { rememberAttribution, storedAttribution } from './attribution.ts';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { useSignUp, type SignUpDetails } from './signUp.ts';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const NEW_USER = '00000000-0000-4000-8000-0000000000a1';
const MEMBER = '00000000-0000-4000-8000-0000000000c1';

/** A fake API: each path answers with its reply (200 and null otherwise); every call is kept with what it sent. */
function renderSignUp(replies: Record<string, { status?: number; body: unknown }>) {
  const calls: { url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body;
    calls.push({ url, body });
    const path = Object.keys(replies).find((key) => url.includes(key));
    const reply = path ? replies[path] : undefined;
    return Response.json(reply?.body ?? null, { status: reply?.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(NEW_USER), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => useSignUp(), { wrapper });
  return { result, calls };
}

const DETAILS: SignUpDetails = { fullName: 'Tara Joshi', city: 'Gurugram', occupation: 'salaried', playTimes: ['weekends'], photo: null };
const JOINED = { '/rpc/sign_up': { body: MEMBER } };

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('useSignUp', () => {
  it('signs up with the name and the codes the player arrived with, saves the answers, then forgets the codes', async () => {
    rememberAttribution('?ref=FRIEND1&utm_source=instagram');
    const attribution = storedAttribution();
    const { result, calls } = renderSignUp(JOINED);

    expect(await act(() => result.current.mutateAsync(DETAILS))).toEqual({ ok: true, value: null });
    expect(calls.find((call) => call.url.includes('/rpc/sign_up'))?.body).toEqual({ p_full_name: 'Tara Joshi', p_attribution: attribution });
    expect(calls.find((call) => call.url.includes('/rpc/set_my_sign_up_answers'))?.body)
      .toEqual({ p_city: 'Gurugram', p_occupation: 'salaried', p_play_times: ['weekends'] });
    expect(calls.some((call) => call.url.includes('/storage/'))).toBe(false);
    expect(attribution).toMatchObject({ referral: 'FRIEND1', utmSource: 'instagram' });
    expect(storedAttribution()).toBeNull();
  });

  it('sends the photo through the kyc function, as the selfie goes', async () => {
    const photo = new Blob(['photo'], { type: 'image/jpeg' });
    const { result, calls } = renderSignUp({ ...JOINED, '/functions/v1/kyc': { body: { status: 'kept' } } });
    expect(await act(() => result.current.mutateAsync({ ...DETAILS, photo }))).toEqual({ ok: true, value: null });
    expect(calls.find((call) => call.url.includes('/functions/v1/kyc'))?.body).toEqual({ action: 'photo', image: 'cGhvdG8=' });
    expect(calls.some((call) => call.url.includes('/storage/'))).toBe(false);
  });

  it('says when the photo did not go through, and when an answer did not fit', async () => {
    const photo = new Blob(['photo'], { type: 'image/jpeg' });
    const failed = renderSignUp({ ...JOINED, '/functions/v1/kyc': { status: 400, body: { error: 'image must be a JPEG' } } });
    expect(await act(() => failed.result.current.mutateAsync({ ...DETAILS, photo }))).toEqual({ ok: false, error: 'photo_failed' });

    const unfit = renderSignUp({ ...JOINED, '/rpc/set_my_sign_up_answers': { status: 400, body: { code: '22023', message: 'Answer from the lists' } } });
    expect(await act(() => unfit.result.current.mutateAsync(DETAILS))).toEqual({ ok: false, error: 'invalid_answers' });
  });

  it('says when the name was refused or sign-up is switched off', async () => {
    const refused = renderSignUp({ '/rpc/sign_up': { status: 400, body: { code: '22023', message: 'A full name is needed' } } });
    expect(await act(() => refused.result.current.mutateAsync({ ...DETAILS, fullName: 'X' }))).toEqual({ ok: false, error: 'invalid_name' });

    const stopped = renderSignUp({ '/rpc/sign_up': { status: 400, body: { code: 'RVKIL', message: 'feature_switched_off: kyc_signup' } } });
    expect(await act(() => stopped.result.current.mutateAsync(DETAILS))).toEqual({ ok: false, error: 'stopped' });
  });
});

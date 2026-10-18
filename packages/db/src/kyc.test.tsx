import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useKycActions, useKycRecord } from './kyc.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const ASHA = '00000000-0000-4000-8000-000000000301';

/** A fake API: the kyc function answers with `kyc`, PostgREST's kyc_record with `record`. */
function renderKyc(replies: { kyc?: { status: number; body: unknown }; record?: unknown }) {
  const calls: { url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const reply = url.includes('/functions/v1/kyc') ? (replies.kyc ?? { status: 200, body: {} }) : { status: 200, body: replies.record ?? null };
    return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'content-type': 'application/json' } });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(ASHA), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({ record: useKycRecord(), actions: useKycActions() }), { wrapper });
  return { result, calls };
}

afterEach(cleanup);

describe('useKycRecord', () => {
  it('gives the member their check, the masked Aadhaar and no more', async () => {
    const { result } = renderKyc({
      record: { status: 'verified', photo_path: 'v/m/selfie.jpg', date_of_birth: '1990-01-01', masked_aadhaar: 'XXXX XXXX 0000', pan: 'ABCPE1234F' },
    });

    await waitFor(() => expect(result.current.record.data).toEqual({
      status: 'verified', hasSelfie: true, dateOfBirth: '1990-01-01', maskedAadhaar: 'XXXX XXXX 0000', pan: 'ABCPE1234F',
    }));
  });
});

describe('useKycActions', () => {
  const photo = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: 'image/jpeg' });

  it('sends the selfie as base64 and gives the status after it', async () => {
    const { result, calls } = renderKyc({ kyc: { status: 200, body: { status: 'started' } } });

    expect(await act(() => result.current.actions.sendSelfie.mutateAsync(photo))).toEqual({ ok: true, value: 'started' });
    expect(calls.find((call) => call.url.includes('/functions/v1/kyc'))?.body).toEqual({ action: 'selfie', image: '/9j/4A==' });
  });

  it('says when a selfie did not pass liveness', async () => {
    const { result } = renderKyc({ kyc: { status: 422, body: { error: 'not_live' } } });

    expect(await act(() => result.current.actions.sendSelfie.mutateAsync(photo))).toEqual({ ok: false, error: 'not_live' });
  });

  it('starts the DigiLocker hand-off and gives the URL to send the member to', async () => {
    const { result, calls } = renderKyc({ kyc: { status: 200, body: { redirectUrl: 'https://digilocker.example/consent' } } });

    const started = await act(() => result.current.actions.start.mutateAsync());

    expect(started).toEqual({ ok: true, value: 'https://digilocker.example/consent' });
    expect(calls.find((call) => call.url.includes('/functions/v1/kyc'))?.body).toEqual({ action: 'start' });
  });

  it('completes the check with the status the function gives', async () => {
    const { result } = renderKyc({ kyc: { status: 200, body: { status: 'needs_pan' } } });

    expect(await act(() => result.current.actions.complete.mutateAsync())).toEqual({ ok: true, value: 'needs_pan' });
  });

  it('says not_configured when a real venue has no KYC vendor yet', async () => {
    const { result } = renderKyc({ kyc: { status: 503, body: { error: 'not_configured' } } });

    expect(await act(() => result.current.actions.start.mutateAsync())).toEqual({ ok: false, error: 'not_configured' });
  });

  it('says stopped while KYC sign-up is switched off, and too_many_attempts past the day\'s limit', async () => {
    const stopped = renderKyc({ kyc: { status: 423, body: { error: 'stopped' } } });
    expect(await act(() => stopped.result.current.actions.start.mutateAsync())).toEqual({ ok: false, error: 'stopped' });
    cleanup();
    const limited = renderKyc({ kyc: { status: 429, body: { error: 'too_many_attempts' } } });
    expect(await act(() => limited.result.current.actions.start.mutateAsync())).toEqual({ ok: false, error: 'too_many_attempts' });
  });

  it('says pan_rejected when the PAN does not match', async () => {
    const { result } = renderKyc({ kyc: { status: 422, body: { error: 'pan_rejected' } } });

    expect(await act(() => result.current.actions.verifyPan.mutateAsync({ pan: 'ABCPE1234F' }))).toEqual({ ok: false, error: 'pan_rejected' });
  });
});

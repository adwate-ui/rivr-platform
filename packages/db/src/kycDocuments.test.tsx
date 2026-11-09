import { createClient } from '@supabase/supabase-js';
import { QueryClient } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useKycDocumentRetake, useMemberKycDocuments, useSendBackKycDocument } from './kycDocuments.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const VIKRAM = '00000000-0000-4000-8000-000000000101';
const NAINA = '00000000-0000-4000-8000-000000000203';

const PAN_ROW = {
  kind: 'pan', path: `v1/${NAINA}/doc-pan-1.jpg`, taken_at: '2026-11-09T18:00:00Z', taken_by: 'Rhea Kulkarni',
  covers_confirmed_by: null, retake_asked_at: null, retake_reason: null,
};

interface Replies {
  rows?: unknown;
  sendBack?: { status: number; body: unknown };
  retake?: { status: number; body: unknown };
}

/** A fake API: member_kyc_documents gives `rows`, ask_kyc_document_retake `sendBack`, the kyc-in-person function `retake`. */
function renderDocuments({ rows = [PAN_ROW], sendBack, retake }: Replies) {
  const calls: { url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const reply = url.includes('/functions/v1/kyc-in-person') ? (retake ?? { status: 200, body: { status: 'retaken' } })
      : url.includes('/rpc/ask_kyc_document_retake') ? (sendBack ?? { status: 200, body: null })
      : { status: 200, body: rows };
    return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'content-type': 'application/json' } });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(VIKRAM), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client} queryClient={queryClient}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({
    documents: useMemberKycDocuments('v1', NAINA), sendBack: useSendBackKycDocument('v1', NAINA), retake: useKycDocumentRetake('v1'),
  }), { wrapper });
  return { result, calls };
}

afterEach(cleanup);

describe('useMemberKycDocuments', () => {
  it('gives a super admin each photo on file and who took it, with no confirmer on a PAN', async () => {
    const { result } = renderDocuments({});
    await waitFor(() => expect(result.current.documents.data).toEqual([{
      kind: 'pan', path: PAN_ROW.path, takenAt: PAN_ROW.taken_at, takenBy: 'Rhea Kulkarni', coversConfirmedBy: null, retakeAskedAt: null, retakeReason: null,
    }]));
  });

  it('treats a kind this console does not know as a fault, never as some other document', async () => {
    const { result } = renderDocuments({ rows: [{ ...PAN_ROW, kind: 'passport' }] });
    await waitFor(() => expect(result.current.documents.isError).toBe(true));
  });
});

describe('useSendBackKycDocument', () => {
  it('sends the reason in the database\'s terms', async () => {
    const { result, calls } = renderDocuments({});
    let done: unknown;
    await act(async () => {
      done = await result.current.sendBack.mutateAsync({ kind: 'aadhaar_front', reason: 'Digits showing' });
    });
    expect(done).toMatchObject({ ok: true, value: 'sent_back' });
    expect(calls.find(({ url }) => url.includes('ask_kyc_document_retake'))?.body).toEqual({ p_member_id: NAINA, p_kind: 'aadhaar_front', p_reason: 'Digits showing' });
  });

  it.each([['22023', 'invalid'], ['42501', 'not_allowed'], ['XX000', 'unavailable']])('reads the refusal %s as %s', async (code, failure) => {
    const { result } = renderDocuments({ sendBack: { status: 400, body: { code, message: 'no' } } });
    let done: unknown;
    await act(async () => {
      done = await result.current.sendBack.mutateAsync({ kind: 'pan', reason: 'Blurred' });
    });
    expect(done).toMatchObject({ ok: false, error: failure });
  });
});

describe('useKycDocumentRetake', () => {
  it('sends the new photo and the word on its bars to the function', async () => {
    const { result, calls } = renderDocuments({});
    let done: unknown;
    await act(async () => {
      done = await result.current.retake.mutateAsync({ memberId: NAINA, kind: 'aadhaar_front', coversConfirmed: true, photo: new Blob(['jpeg']) });
    });
    expect(done).toMatchObject({ ok: true, value: 'retaken' });
    expect(calls.find(({ url }) => url.includes('kyc-in-person'))?.body).toEqual({ memberId: NAINA, kind: 'aadhaar_front', coversConfirmed: true, image: btoa('jpeg') });
  });

  it.each([['no_photo', 'no_photo'], ['decided', 'decided'], ['something_new', 'unavailable']])('reads the reply %s as %s', async (error, failure) => {
    const { result } = renderDocuments({ retake: { status: 409, body: { error } } });
    let done: unknown;
    await act(async () => {
      done = await result.current.retake.mutateAsync({ memberId: NAINA, kind: 'pan', coversConfirmed: false, photo: new Blob(['jpeg']) });
    });
    expect(done).toMatchObject({ ok: false, error: failure });
  });
});

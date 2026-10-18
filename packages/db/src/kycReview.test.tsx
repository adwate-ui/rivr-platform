import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useKycReviewActions, useKycReviewQueue } from './kycReview.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const ADITYA = '00000000-0000-4000-8000-000000000103';

/** A fake API: each path answers with its reply; the calls are recorded. */
function renderReview(replies: Record<string, { status?: number; body: unknown }>) {
  const calls: { url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const path = Object.keys(replies).find((key) => url.includes(key));
    const reply = path ? replies[path] : undefined;
    return Response.json(reply?.body ?? null, { status: reply?.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(ADITYA), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({ queue: useKycReviewQueue('v1'), actions: useKycReviewActions('v1') }), { wrapper });
  return { result, calls };
}

afterEach(cleanup);

describe('KYC review', () => {
  it('gives the venue\'s checks as a reviewer sees them', async () => {
    const { result, calls } = renderReview({
      '/rpc/kyc_review_queue': {
        body: [{
          member_id: 'm204', full_name: 'Rohan Bhatia', status: 'needs_review', method: 'pan', waiting_because: 'pan_alone',
          date_of_birth: '1995-01-01', masked_aadhaar: null, pan: 'ABCPD1111D', address: null, photo_path: 'v1/m204/selfie.jpg',
          liveness_score: 91, face_match_score: null, vendor_reference: 'fake-pan', refusal: null, clashes_with: ['Arjun Mehta'],
          updated_at: '2026-10-18T10:00:00Z',
        }],
      },
    });
    await waitFor(() => expect(result.current.queue.data).toEqual([{
      memberId: 'm204', fullName: 'Rohan Bhatia', status: 'needs_review', method: 'pan', waitingBecause: 'pan_alone', dateOfBirth: '1995-01-01',
      maskedAadhaar: null, pan: 'ABCPD1111D', address: null, photoPath: 'v1/m204/selfie.jpg', livenessScore: 91, faceMatchScore: null,
      vendorReference: 'fake-pan', refusal: null, clashesWith: ['Arjun Mehta'], updatedAt: '2026-10-18T10:00:00Z',
    }]));
    expect(calls.find((call) => call.url.includes('/rpc/kyc_review_queue'))?.body).toEqual({ p_venue_id: 'v1' });
  });

  it('decides a check with the reason, sending a date of birth only when given, and says why one did not go through', async () => {
    const decided = renderReview({ '/rpc/kyc_review_queue': { body: [] }, '/rpc/review_kyc': { body: 'verified' } });
    expect(await act(() => decided.result.current.actions.review.mutateAsync({ memberId: 'm202', approve: true, reason: 'PAN card seen' })))
      .toEqual({ ok: true, value: 'verified' });
    expect(decided.calls.find((call) => call.url.includes('/rpc/review_kyc'))?.body).toEqual({ p_member_id: 'm202', p_approve: true, p_reason: 'PAN card seen' });
    cleanup();

    const refused = renderReview({ '/rpc/kyc_review_queue': { body: [] }, '/rpc/review_kyc': { status: 400, body: { code: 'RVDOB', message: 'Enter the date of birth' } } });
    expect(await act(() => refused.result.current.actions.review.mutateAsync({ memberId: 'm203', approve: true, reason: 'Aadhaar seen' })))
      .toEqual({ ok: false, error: 'needs_date_of_birth' });
  });
});

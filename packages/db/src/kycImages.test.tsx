import { createClient } from '@supabase/supabase-js';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useKycImageUrl } from './kycImages.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const ADITYA = '00000000-0000-4000-8000-000000000103';
const PATH = '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000201/aadhaar.jpg';

/** A fake kyc-image-url function that answers with `reply`, recording each request. */
function renderSignedIn(reply: { status: number; body: unknown }, path: string | null = PATH, userId: string | null = ADITYA) {
  const requests: { url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    requests.push({ url: input instanceof Request ? input.url : String(input), body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'content-type': 'application/json' } });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(userId), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => useKycImageUrl(path), { wrapper });
  return { result, requests };
}

afterEach(cleanup);

describe('useKycImageUrl', () => {
  it('asks the kyc-image-url function for the image and gives the signed URL on Storage', async () => {
    const { result, requests } = renderSignedIn({ status: 200, body: { signedPath: `/object/sign/kyc/${PATH}?token=t` } });

    await waitFor(() => expect(result.current.data).toBe(`http://127.0.0.1:9/storage/v1/object/sign/kyc/${PATH}?token=t`));
    expect(requests.at(-1)).toEqual({ url: 'http://127.0.0.1:9/functions/v1/kyc-image-url', body: { path: PATH } });
  });

  it('is an error when the function refuses, as it does for anyone without KYC review or the cage', async () => {
    const { result } = renderSignedIn({ status: 403, body: { error: 'Not allowed to see this image' } });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('asks for nothing without an image, or before anyone is signed in', () => {
    const noImage = renderSignedIn({ status: 200, body: {} }, null);
    const signedOut = renderSignedIn({ status: 200, body: {} }, PATH, null);

    expect(noImage.result.current.fetchStatus).toBe('idle');
    expect(signedOut.result.current.fetchStatus).toBe('idle');
    expect([...noImage.requests, ...signedOut.requests].filter((request) => request.url.includes('kyc-image-url'))).toEqual([]);
  });
});

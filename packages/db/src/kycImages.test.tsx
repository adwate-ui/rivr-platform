import { createClient } from '@supabase/supabase-js';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { KYC_IMAGE_URL_SECONDS, useKycImageUrl } from './kycImages.ts';
import { RivrDataProvider } from './provider.tsx';

const PATH = '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000201/aadhaar.jpg';

/** A fake Storage API that answers a sign request with `reply`, recording each request. */
function renderWithStorage(reply: { status: number; body: unknown }, path: string | null = PATH) {
  const requests: { url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    requests.push({ url: input instanceof Request ? input.url : String(input), body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'content-type': 'application/json' } });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => useKycImageUrl(path), { wrapper });
  return { result, requests };
}

afterEach(cleanup);

describe('useKycImageUrl', () => {
  it('asks Storage for a link to the image that lives a minute', async () => {
    const { result, requests } = renderWithStorage({ status: 200, body: { signedURL: `/object/sign/kyc/${PATH}?token=t` } });

    await waitFor(() => expect(result.current.data).toBe(`http://127.0.0.1:9/storage/v1/object/sign/kyc/${PATH}?token=t`));
    expect(requests[0]?.url).toBe(`http://127.0.0.1:9/storage/v1/object/sign/kyc/${PATH}`);
    expect(requests[0]?.body).toEqual({ expiresIn: KYC_IMAGE_URL_SECONDS });
    expect(KYC_IMAGE_URL_SECONDS).toBe(60);
  });

  it('is an error when Storage refuses, as it does for anyone without KYC review or the cage', async () => {
    const { result } = renderWithStorage({ status: 400, body: { statusCode: '404', error: 'not_found', message: 'Object not found' } });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('asks for nothing without an image', () => {
    const { result, requests } = renderWithStorage({ status: 200, body: {} }, null);

    expect(result.current.fetchStatus).toBe('idle');
    expect(requests).toEqual([]);
  });
});

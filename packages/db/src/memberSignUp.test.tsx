import { createClient } from '@supabase/supabase-js';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useMemberSignUp } from './memberSignUp.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const SIGNED_IN = '00000000-0000-4000-8000-000000000103';
const VENUE = '00000000-0000-4000-8000-000000000001';
const MEMBER = '00000000-0000-4000-8000-000000000211';

/** A fake API answering member_sign_up with `rows`; every call is kept with what it sent. */
function clientFor(rows: unknown[]) {
  const calls: { url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return Response.json(url.includes('/rpc/member_sign_up') ? rows : null);
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(SIGNED_IN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client} queryClient={queryClient}>{children}</RivrDataProvider>;
  return { wrapper, calls };
}

const ROW = {
  signed_up_at: '2026-10-20T10:00:00Z', city: 'Gurugram', occupation: 'salaried', play_times: ['weekends', 'brunch'], games_played: ['plo'],
  referral_code: 'RIVR7', creator_code: null, utm_source: 'instagram', utm_medium: null, utm_campaign: 'diwali', utm_content: null, utm_term: null,
  first_seen_at: '2026-10-19T18:00:00Z',
};

afterEach(cleanup);

describe('useMemberSignUp', () => {
  it('reads a member\'s sign-up for the venue in use, dropping any answer sign-up no longer offers', async () => {
    const { wrapper, calls } = clientFor([ROW]);
    const { result } = renderHook(() => useMemberSignUp(VENUE, MEMBER), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual({
      signedUpAt: '2026-10-20T10:00:00Z', city: 'Gurugram', occupation: 'salaried', playTimes: ['weekends'], gamesPlayed: ['plo'],
      referralCode: 'RIVR7', creatorCode: null,
      campaign: { source: 'instagram', medium: null, campaign: 'diwali', content: null, term: null }, firstSeenAt: '2026-10-19T18:00:00Z',
    });
    expect(calls.find((call) => call.url.includes('/rpc/member_sign_up'))?.body).toEqual({ p_venue_id: VENUE, p_member_id: MEMBER });
  });

  it('is null for someone who is not a member of the venue, and an answer it cannot read is no answer', async () => {
    const none = renderHook(() => useMemberSignUp(VENUE, MEMBER), { wrapper: clientFor([]).wrapper });
    await waitFor(() => expect(none.result.current.data).toBeNull());
    const odd = renderHook(() => useMemberSignUp(VENUE, MEMBER), { wrapper: clientFor([{ ...ROW, occupation: 'astronaut' }]).wrapper });
    await waitFor(() => expect(odd.result.current.data?.occupation).toBeNull());
  });
});

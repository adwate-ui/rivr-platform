import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useAddLearnSource, useLearnSources } from './learnSources.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const VENUE = '00000000-0000-4000-8000-000000000001';

function renderHooks(replies: Record<string, { status?: number; body: unknown }>) {
  const calls: { url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, body: typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body });
    const path = Object.keys(replies).find((key) => url.includes(key));
    const reply = path ? replies[path] : undefined;
    return Response.json(reply?.body ?? [], { status: reply?.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor('00000000-0000-4000-8000-000000000101'), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({ sources: useLearnSources(VENUE), add: useAddLearnSource(VENUE) }), { wrapper });
  return { result, calls };
}

afterEach(cleanup);

describe('learn sources', () => {
  it('reads the venue\'s sources, and uploads a checked encoding before registering it', async () => {
    const { result, calls } = renderHooks({
      '/rest/v1/learn_source': { body: [{ source_key: 'src_book', title: 'The Book', author: null, licence_terms: 'For the club', licence_ends_on: '2027-03-31' }] },
      '/storage/v1/object/learn-sources': { body: { Key: 'learn-sources/x' } },
      '/rpc/register_learn_source': { status: 403, body: { code: '42501', message: 'no' } },
    });
    await waitFor(() => expect(result.current.sources.data).toEqual([
      { sourceKey: 'src_book', title: 'The Book', author: null, licenceTerms: 'For the club', licenceEndsOn: '2027-03-31' },
    ]));
    let added: unknown;
    await act(async () => {
      added = await result.current.add.mutateAsync({
        raw: '{}', sourceKey: 'src_book', sourceHash: 'abc', title: 'The Book', author: null, licenceTerms: 'For the club', licenceEndsOn: '2027-03-31',
      });
    });
    expect(added).toEqual({ ok: false, error: 'not_allowed' });
    expect(calls.some((call) => call.url.includes(`/storage/v1/object/learn-sources/${VENUE}/src_book.json`))).toBe(true);
    expect(calls.find((call) => call.url.includes('/rpc/register_learn_source'))?.body).toEqual({
      p_venue_id: VENUE, p_source_key: 'src_book', p_title: 'The Book', p_author: '', p_source_hash: 'abc', p_licence_terms: 'For the club',
      p_licence_ends_on: '2027-03-31',
    });
  });
});

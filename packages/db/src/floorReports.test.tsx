import { createClient } from '@supabase/supabase-js';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useInterestLists, usePotData } from './floorReports.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const SIGNED_IN = '00000000-0000-4000-8000-000000000101';
const VENUE = '00000000-0000-4000-8000-000000000001';

/** A fake API: each path answers with its reply; every call is kept with what it sent. */
function renderHooks(replies: Record<string, { body: unknown }>) {
  const calls: { url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const path = Object.keys(replies).find((key) => url.includes(key));
    return Response.json(path ? replies[path]?.body : null);
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(SIGNED_IN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({ interest: useInterestLists(VENUE), hands: usePotData(VENUE, '2026-11-15', '2026-11-16') }), { wrapper });
  return { result, calls };
}

afterEach(cleanup);

describe('interest lists and pot data', () => {
  it('reads the games not running, and the period\'s hands in paise', async () => {
    const { result, calls } = renderHooks({
      '/rpc/interest_lists': { body: [{ table_type_id: 'pr', waiting: 4, players_to_open: 4, is_ready: true }] },
      '/rpc/pot_data': {
        body: [{
          hand_id: 'h1', played_at: '2026-11-15T15:30:00Z', table_id: 't2', table_name: 'Table 2', dealer_id: 's1', dealer_name: 'Pema Lepcha',
          variant: 'plo', pot_paise: 1000000, rake_paise: 50000, drop_paise: 10000, is_cap_applied: false, high_hand: null,
        }],
      },
    });
    await waitFor(() => expect(result.current.interest.data).toEqual([{ tableTypeId: 'pr', waiting: 4, playersToOpen: 4, isReady: true }]));
    await waitFor(() => expect(result.current.hands.data?.[0]).toMatchObject({ tableName: 'Table 2', variant: 'plo', pot: 1000000n, rake: 50000n }));
    expect(calls.find((call) => call.url.includes('/rpc/pot_data'))?.body).toEqual({
      p_venue_id: VENUE, p_from: '2026-11-15T00:30:00.000Z', p_until: '2026-11-17T00:30:00.000Z',
    });
  });
});

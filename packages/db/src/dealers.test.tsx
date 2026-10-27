import { createClient } from '@supabase/supabase-js';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useDealerNights, useDealerRotation } from './dealers.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const SIGNED_IN = '00000000-0000-4000-8000-000000000103';
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
  const { result } = renderHook(() => ({ board: useDealerRotation(VENUE), nights: useDealerNights(VENUE, '2026-11-15', '2026-11-15') }), { wrapper });
  return { result, calls };
}

afterEach(cleanup);

describe('the dealers\' board', () => {
  it('reads who deals and who rests, and each dealer\'s period in paise', async () => {
    const { result, calls } = renderHooks({
      '/rpc/dealer_rotation': {
        body: [
          { state: 'dealing', staff_id: 's1', dealer_name: 'Manoj Thapa', table_id: 't1', table_name: 'Table 1', since: '2026-11-15T15:00:00Z', minutes: 40, is_due: true },
          { state: 'resting', staff_id: 's2', dealer_name: 'Bhavna Rawat', table_id: null, table_name: null, since: '2026-11-15T15:20:00Z', minutes: 20, is_due: false },
        ],
      },
      '/rpc/dealer_nights': {
        body: [{ staff_id: 's2', dealer_name: 'Bhavna Rawat', downs: 1, dealt_seconds: 3600, hands: 3, hands_per_hour: 3, rake_paise: 15000,
                 variance_paise: -5000, counted_downs: 1 }],
      },
    });
    await waitFor(() => expect(result.current.board.data).toEqual([
      { staffId: 's1', dealerName: 'Manoj Thapa', state: 'dealing', tableName: 'Table 1', since: '2026-11-15T15:00:00Z', minutes: 40, isDue: true },
      { staffId: 's2', dealerName: 'Bhavna Rawat', state: 'resting', tableName: null, since: '2026-11-15T15:20:00Z', minutes: 20, isDue: false },
    ]));
    await waitFor(() => expect(result.current.nights.data).toEqual([
      { staffId: 's2', dealerName: 'Bhavna Rawat', downs: 1, dealtSeconds: 3600, hands: 3, handsPerHour: 3, rake: 15000n, variance: -5000n, countedDowns: 1 },
    ]));
    expect(calls.find((call) => call.url.includes('/rpc/dealer_rotation'))?.body).toEqual({ p_venue_id: VENUE });
    expect(calls.find((call) => call.url.includes('/rpc/dealer_nights'))?.body).toEqual({
      p_venue_id: VENUE, p_from: '2026-11-15T00:30:00.000Z', p_until: '2026-11-16T00:30:00.000Z',
    });
  });
});

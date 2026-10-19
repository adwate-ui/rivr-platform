import { createClient } from '@supabase/supabase-js';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useFloorNight, useTableHands } from './floorNight.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const STAFF = '00000000-0000-4000-8000-000000000129';
const VENUE = '00000000-0000-4000-8000-000000000001';

/** A fake API: each RPC answers with its rows; every call is kept with what it was sent. */
function renderFloor(replies: Record<string, unknown[]>) {
  const calls: { rpc: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const rpc = (input instanceof Request ? input.url : String(input)).split('/rpc/')[1] ?? '';
    calls.push({ rpc, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return Response.json(replies[rpc] ?? []);
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(STAFF), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({ night: useFloorNight(VENUE), hands: useTableHands('t3') }), { wrapper });
  return { result, calls };
}

afterEach(cleanup);

describe('The live floor\'s night', () => {
  it('gives each table\'s figures in paise, and the venue\'s rake tonight', async () => {
    const { result } = renderFloor({ floor_tonight: [
      { table_id: 't3', hands: 287, hands_last_hour: 30, dealer_name: 'Pema Lepcha', rake_paise: 9630000, venue_rake_paise: 41175000,
        rake_basis_points: 500, rake_cap_paise: 600000 },
      { table_id: 't4', hands: 0, hands_last_hour: 0, dealer_name: null, rake_paise: 0, venue_rake_paise: 41175000,
        rake_basis_points: null, rake_cap_paise: null },
    ] });
    await waitFor(() => expect(result.current.night.data).toEqual({
      rake: 41_175_000n,
      tables: [
        { tableId: 't3', hands: 287, handsLastHour: 30, dealerName: 'Pema Lepcha', rake: 9_630_000n, rakeBasisPoints: 500, rakeCap: 600_000n },
        { tableId: 't4', hands: 0, handsLastHour: 0, dealerName: null, rake: 0n, rakeBasisPoints: null, rakeCap: null },
      ],
    }));
  });

  it('gives no rake, and no pot, to staff who do not read the ledger', async () => {
    const { result, calls } = renderFloor({
      floor_tonight: [{ table_id: 't3', hands: 3, hands_last_hour: 2, dealer_name: null, rake_paise: null, venue_rake_paise: null,
        rake_basis_points: 500, rake_cap_paise: 600000 }],
      table_hands: [{ hand_id: 'h3', number: 3, played_at: '2026-11-15T17:25:00Z', variant: 'plo', pot_paise: null, rake_paise: null }],
    });
    await waitFor(() => expect(result.current.night.data?.rake).toBeNull());
    expect(result.current.night.data?.tables[0]?.rake).toBeNull();
    await waitFor(() => expect(result.current.hands.data).toEqual([
      { handId: 'h3', number: 3, playedAt: '2026-11-15T17:25:00Z', variant: 'plo', pot: null, rake: null },
    ]));
    expect(calls.find((call) => call.rpc === 'table_hands')?.body).toEqual({ p_table_id: 't3', p_limit: 3 });
  });

  it('reads an empty floor as no rake', async () => {
    const { result } = renderFloor({ floor_tonight: [] });
    await waitFor(() => expect(result.current.night.data).toEqual({ rake: null, tables: [] }));
  });
});

import { createClient } from '@supabase/supabase-js';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';
import { useTopUpHistory } from './topUpHistory.ts';

const SIGNED_IN = '00000000-0000-4000-8000-0000000d0791';
const VENUE = '00000000-0000-4000-8000-000000000001';

/** A fake API that answers top_up_history with `rows`, and what it was asked. */
function renderHistory(rows: readonly object[], day = '2026-11-14', page = 1) {
  const asked: unknown[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!url.includes('/rpc/top_up_history')) return Response.json([]);
    asked.push(init?.body ? JSON.parse(String(init.body)) : undefined);
    return Response.json(rows);
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(SIGNED_IN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => useTopUpHistory(VENUE, day, page), { wrapper });
  return { result, asked };
}

afterEach(cleanup);

describe('a past day’s top-up requests (redesign RD-32)', () => {
  it('asks for one page of the day and reads who took each step, how long it took and how many the day has', async () => {
    const { result, asked } = renderHistory([
      { request_id: 'p1', table_name: 'Table 1', seat: 2, full_name: 'Ishaan Verma', status: 'fulfilled', requested_at: '2026-11-14T15:30:00Z',
        accepted_by: 'Pooja Nair', accepted_seconds: 75, done_by: 'Pooja Nair', done_seconds: 140, total: 51 },
      { request_id: 'p2', table_name: 'Table 4', seat: 7, full_name: 'Vihaan Kapoor', status: 'a status of another day', requested_at: '2026-11-14T14:10:00Z',
        accepted_by: null, accepted_seconds: null, done_by: null, done_seconds: null, total: 51 },
    ], '2026-11-14', 2);
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(asked).toEqual([{ p_venue_id: VENUE, p_day: '2026-11-14', p_page: 2, p_page_size: 50 }]);
    expect(result.current.data?.total).toBe(51);
    expect(result.current.data?.rows).toEqual([
      { requestId: 'p1', tableName: 'Table 1', seat: 2, fullName: 'Ishaan Verma', status: 'fulfilled', requestedAt: '2026-11-14T15:30:00Z',
        acceptedBy: 'Pooja Nair', acceptedSeconds: 75, doneBy: 'Pooja Nair', doneSeconds: 140 },
      // A status this console does not know reads as asked for.
      { requestId: 'p2', tableName: 'Table 4', seat: 7, fullName: 'Vihaan Kapoor', status: 'requested', requestedAt: '2026-11-14T14:10:00Z',
        acceptedBy: null, acceptedSeconds: null, doneBy: null, doneSeconds: null },
    ]);
  });

  it('reads a day with none as no rows and a total of nought', async () => {
    const { result } = renderHistory([]);
    await waitFor(() => expect(result.current.data).toEqual({ rows: [], total: 0 }));
  });

  it('asks nothing until a day is chosen', async () => {
    const { result, asked } = renderHistory([], '');
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(asked).toEqual([]);
    expect(result.current.data).toBeUndefined();
  });
});

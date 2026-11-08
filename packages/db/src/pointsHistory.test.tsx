import { createClient } from '@supabase/supabase-js';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useMyPointsHistory } from './pointsHistory.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

/** A fake API that answers my_points_history with `body`; every request's body is kept. */
function clientFor(body: unknown, status = 200) {
  const sent: unknown[] = [];
  const fetch: typeof globalThis.fetch = async (_input, init) => {
    sent.push(JSON.parse(String(init?.body)));
    return Response.json(body, { status });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor('00000000-0000-4000-8000-0000000d0712'), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client} queryClient={queryClient}>{children}</RivrDataProvider>;
  return { wrapper, sent };
}

afterEach(cleanup);

describe('points history', () => {
  it('reads the member\u2019s newest lines, as many as asked for', async () => {
    const { wrapper, sent } = clientFor([
      { line_id: 't2', at: '2026-11-15T18:00:00Z', kind: 'spent', points: 500, reason: 'Redeemed: RIVR cap' },
      { line_id: 't1', at: '2026-11-14T18:00:00Z', kind: 'something new', points: 250, reason: 'Points for the visit' },
    ]);
    const { result } = renderHook(() => useMyPointsHistory(20), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([
      { id: 't2', at: '2026-11-15T18:00:00Z', kind: 'spent', points: 500n, reason: 'Redeemed: RIVR cap' },
      { id: 't1', at: '2026-11-14T18:00:00Z', kind: 'earned', points: 250n, reason: 'Points for the visit' },
    ]));
    expect(sent).toEqual([{ p_limit: 20 }]);
  });

  it('fails when the read fails', async () => {
    const { wrapper } = clientFor({ code: 'XX000', message: 'down' }, 500);
    const { result } = renderHook(() => useMyPointsHistory(20), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

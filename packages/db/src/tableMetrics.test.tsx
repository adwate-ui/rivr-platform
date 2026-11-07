import { createClient } from '@supabase/supabase-js';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { useTableMetrics } from './tableMetrics.ts';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const SIGNED_IN = '00000000-0000-4000-8000-000000000103';
const VENUE = '00000000-0000-4000-8000-000000000001';

afterEach(cleanup);

describe('useTableMetrics', () => {
  it('reads each table over a span of club days, money-free (owner, 8 Nov)', async () => {
    const calls: unknown[] = [];
    const fetch: typeof globalThis.fetch = async (input, init) => {
      calls.push({ url: input instanceof Request ? input.url : String(input), body: init?.body ? JSON.parse(String(init.body)) : undefined });
      return Response.json([{ table_id: 't2', table_name: 'Table 2', seats: 9, run_seconds: 14_400, players: 2, peak: 2, player_seconds: 16_200 }]);
    };
    const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
      global: { fetch },
      auth: { storage: sessionStorageFor(SIGNED_IN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client} queryClient={queryClient}>{children}</RivrDataProvider>;
    const { result } = renderHook(() => useTableMetrics(VENUE, '2026-11-01', '2026-11-07'), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual([{ tableId: 't2', tableName: 'Table 2', seats: 9, runSeconds: 14_400, players: 2, peak: 2, playerSeconds: 16_200 }]);
    expect(calls).toContainEqual({ url: 'http://127.0.0.1:9/rest/v1/rpc/table_metrics', body: { p_venue_id: VENUE, p_from: '2026-11-01', p_to: '2026-11-07' } });
  });
});

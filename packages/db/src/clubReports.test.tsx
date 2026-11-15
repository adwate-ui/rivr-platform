import { createClient } from '@supabase/supabase-js';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import { useBonusReport, useFnbReport, usePlayersReport, useReportChart, useReportFigures, useWaitlistReport } from './clubReports.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const SIGNED_IN = '00000000-0000-4000-8000-000000000103';
const SPAN = { venueId: '00000000-0000-4000-8000-000000000001', from: '2026-11-09', to: '2026-11-15' };
const ASKED = { p_venue_id: SPAN.venueId, p_from: SPAN.from, p_to: SPAN.to };

afterEach(cleanup);

/** A signed-in provider over a fake API that answers every read with `rows` (or fails), keeping what was asked. */
function fakeApi(rows: unknown[], status = 200) {
  const calls: unknown[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    calls.push({ url: input instanceof Request ? input.url : String(input), body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return status === 200 ? Response.json(rows) : Response.json({ message: 'Only staff who read reports see them', code: '42501' }, { status });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(SIGNED_IN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client} queryClient={queryClient}>{children}</RivrDataProvider>;
  return { calls, wrapper };
}

const urlOf = (name: string) => `http://127.0.0.1:9/rest/v1/rpc/${name}?limit=1000`;

describe('the reports beside Tables (redesign RD-27)', () => {
  it('reads a report’s chart, a bar an hour or a day, for the report named', async () => {
    const { calls, wrapper } = fakeApi([{ bucket: '2026-11-14T00:30:00+00:00', amount: 140 }, { bucket: '2026-11-15T00:30:00+00:00', amount: 178 }]);
    const { result } = renderHook(() => useReportChart(SPAN, 'players'), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([{ at: '2026-11-14T00:30:00+00:00', amount: 140 }, { at: '2026-11-15T00:30:00+00:00', amount: 178 }]));
    expect(calls).toContainEqual({ url: urlOf('report_chart'), body: { ...ASKED, p_report: 'players' } });
  });

  it('reads a report’s four figures by name', async () => {
    const { calls, wrapper } = fakeApi([{ figure: 'orders', amount: 212 }, { figure: 'serve_seconds', amount: 540 }]);
    const { result } = renderHook(() => useReportFigures(SPAN, 'fnb'), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([{ figure: 'orders', amount: 212 }, { figure: 'serve_seconds', amount: 540 }]));
    expect(calls).toContainEqual({ url: urlOf('report_figures'), body: { ...ASKED, p_report: 'fnb' } });
  });

  it('reads who played, a tier by its name', async () => {
    const { calls, wrapper } = fakeApi([{ place: 0, measure: 'played', label: null, amount: 78 }, { place: 4, measure: 'tier', label: 'Black card', amount: 11 }]);
    const { result } = renderHook(() => usePlayersReport(SPAN), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([{ place: 0, measure: 'played', label: null, amount: 78 }, { place: 4, measure: 'tier', label: 'Black card', amount: 11 }]));
    expect(calls).toContainEqual({ url: urlOf('players_report'), body: ASKED });
  });

  it('reads each table’s list over the span', async () => {
    const { wrapper } = fakeApi([{ table_id: 't2', table_name: 'Table 2', joined: 27, seated: 22, left_list: 2, wait_seconds: 2640, longest_seconds: 8580 }]);
    const { result } = renderHook(() => useWaitlistReport(SPAN), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([{ tableId: 't2', tableName: 'Table 2', joined: 27, seated: 22, leftList: 2, waitSeconds: 2640, longestSeconds: 8580 }]));
  });

  it('reads orders by table and by who accepted them, nobody as null', async () => {
    const { wrapper } = fakeApi([
      { grouped_by: 'table', label: 'Table 2', orders: 40, items: 61, accept_seconds: 120, serve_seconds: 540, voided: 1 },
      { grouped_by: 'staff', label: null, orders: 2, items: 0, accept_seconds: 0, serve_seconds: 0, voided: 2 },
    ]);
    const { result } = renderHook(() => useFnbReport(SPAN), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([
      { groupedBy: 'table', label: 'Table 2', orders: 40, items: 61, acceptSeconds: 120, serveSeconds: 540, voided: 1 },
      { groupedBy: 'staff', label: null, orders: 2, items: 0, acceptSeconds: 0, serveSeconds: 0, voided: 2 },
    ]));
  });

  it('reads the Bonus given by where it came from, in paise; a source it does not know is any other reason', async () => {
    const { wrapper } = fakeApi([
      { source: 'hand', label: null, members: 2, grants: 3, given_paise: 300_000 }, { source: 'raffle', label: 'Diwali draw', members: 1, grants: 1, given_paise: 100_000 },
    ]);
    const { result } = renderHook(() => useBonusReport(SPAN), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([
      { source: 'hand', label: null, members: 2, grants: 3, given: 300_000n }, { source: 'other', label: 'Diwali draw', members: 1, grants: 1, given: 100_000n },
    ]));
  });

  it('fails when the server refuses, as for staff who read no reports', async () => {
    const { wrapper } = fakeApi([], 403);
    const { result } = renderHook(() => useBonusReport(SPAN), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

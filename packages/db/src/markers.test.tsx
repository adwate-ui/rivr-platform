import { fromPaise } from '@rivr/domain/money';
import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useMarkerActions, useOpenMarkers } from './markers.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const STAFF = '00000000-0000-4000-8000-000000000104';
const VENUE = '00000000-0000-4000-8000-000000000001';

/** A fake API: each RPC answers with its reply; every call is kept with what it was sent. */
function renderMarkers(replies: Record<string, { status?: number; body: unknown }>) {
  const calls: { rpc: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const rpc = (input instanceof Request ? input.url : String(input)).split('/rpc/')[1] ?? '';
    calls.push({ rpc, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const reply = replies[rpc];
    return Response.json(reply?.body ?? [], { status: reply?.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(STAFF), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({ open: useOpenMarkers(VENUE), actions: useMarkerActions(VENUE) }), { wrapper });
  return { result, calls };
}

afterEach(cleanup);

describe('Markers', () => {
  it('gives open markers in paise, with their age and limit', async () => {
    const { result } = renderMarkers({ open_markers: { body: [{
      marker_id: 'k1', member_id: 'm1', full_name: 'Arjun Mehta', amount_paise: 5000000, outstanding_paise: 5000000,
      issued_at: '2026-11-01T18:00:00Z', due_at: '2026-12-01T18:00:00Z', age_days: 14, is_past_due: false, limit_paise: 20000000,
    }] } });
    await waitFor(() => expect(result.current.open.data).toEqual([{
      markerId: 'k1', memberId: 'm1', fullName: 'Arjun Mehta', amount: 5_000_000n, outstanding: 5_000_000n, issuedAt: '2026-11-01T18:00:00Z',
      dueAt: '2026-12-01T18:00:00Z', ageDays: 14, isPastDue: false, limit: 20_000_000n,
    }]));
  });

  it('issues a marker with its signature once per request id, and says why one is refused', async () => {
    const { result, calls } = renderMarkers({ issue_marker: { status: 400, body: { code: 'RVLIM', message: 'limit' } } });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.actions.issue.mutateAsync({ memberId: 'm1', amount: fromPaise(4_500_000n), signature: 'M 1 1 L 2 2', requestId: 'r1' });
    });
    expect(outcome).toEqual({ ok: false, error: 'above_limit' });
    expect(calls.find((call) => call.rpc === 'issue_marker')?.body).toEqual({
      p_venue_id: VENUE, p_member_id: 'm1', p_amount_paise: 4500000, p_signature_svg: 'M 1 1 L 2 2', p_idempotency_key: 'r1',
    });
  });
});

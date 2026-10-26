import { fromPaise } from '@rivr/domain/money';
import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useCreditReport, useMarkerActions, useOpenMarkers, useRepayment } from './markers.ts';
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
  const { result } = renderHook(() => ({
    open: useOpenMarkers(VENUE), actions: useMarkerActions(VENUE), repay: useRepayment(VENUE), report: useCreditReport(VENUE, '2026-11-15T18:30:00Z'),
  }), { wrapper });
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

  it('takes a repayment by cash with no UTR, and says what it settled (#92)', async () => {
    const { result, calls } = renderMarkers({ repay_markers: { body: [{ o_cage_transaction_id: 'c1', o_settled_paise: 6000000 }] } });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.repay.mutateAsync({ memberId: 'm1', amount: fromPaise(6_000_000n), method: 'cash', utr: null, requestId: 'r2' });
    });
    expect(outcome).toEqual({ ok: true, value: 6_000_000n });
    expect(calls.find((call) => call.rpc === 'repay_markers')?.body).toEqual({
      p_venue_id: VENUE, p_member_id: 'm1', p_amount_paise: 6000000, p_method: 'cash', p_utr: '', p_idempotency_key: 'r2',
    });
  });

  it('says why a repayment is refused', async () => {
    const { result } = renderMarkers({ repay_markers: { status: 400, body: { code: 'RVOVR', message: 'more' } } });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.repay.mutateAsync({ memberId: 'm1', amount: fromPaise(8_000_000n), method: 'upi', utr: '123456789012', requestId: 'r3' });
    });
    expect(outcome).toEqual({ ok: false, error: 'more_than_owed' });
  });

  it('gives the credit report at the moment asked about, by age, in paise', async () => {
    const { result, calls } = renderMarkers({ credit_report: { body: [{
      member_id: 'm1', full_name: 'Arjun Mehta', member_number: 201, limit_paise: 20000000, owed_0_7_paise: 2000000, owed_8_30_paise: 5000000,
      owed_31_60_paise: 0, owed_over_60_paise: 0, owed_paise: 7000000, oldest_issued_at: '2026-11-01T18:00:00Z', is_past_due: false,
    }] } });
    await waitFor(() => expect(result.current.report.data).toEqual([{
      memberId: 'm1', fullName: 'Arjun Mehta', memberNumber: 201, limit: 20_000_000n,
      owed: { '0_7': 2_000_000n, '8_30': 5_000_000n, '31_60': 0n, over_60: 0n }, total: 7_000_000n, oldestIssuedAt: '2026-11-01T18:00:00Z', isPastDue: false,
    }]));
    expect(calls.find((call) => call.rpc === 'credit_report')?.body).toEqual({ p_venue_id: VENUE, p_at: '2026-11-15T18:30:00Z' });
  });
});

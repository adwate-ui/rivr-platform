import { fromPaise } from '@rivr/domain/money';
import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useEodActions, useEodCloses } from './eod.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const STAFF = '00000000-0000-4000-8000-000000000104';
const VENUE = '00000000-0000-4000-8000-000000000001';
const SHORT = {
  close_id: 'c1', opened_at: '2026-10-20T12:30:00Z', opened_by: 'Sana Qureshi', float_paise: 120_600_000, closed_at: '2026-10-21T02:30:00Z',
  closed_by: 'Sana Qureshi', may_review: true,
  counted_cash_paise: 120_550_000, counted_chips_paise: 62_400_000, counted_receipts_paise: 0, counted_markers_paise: 5_000_000,
  expected_cash_paise: 120_600_000, expected_chips_paise: 62_400_000, expected_receipts_paise: 0, expected_markers_paise: 5_000_000,
  cash_variance_paise: -50_000, chips_variance_paise: 0, receipts_variance_paise: 0, markers_variance_paise: 0,
  is_anomaly: true, reason: null, reviewed_by: null, reviewed_at: null,
};

/** A fake API: each RPC answers with its reply; every call is kept with what it was sent. */
function renderEod(replies: Record<string, { status?: number; body: unknown }>) {
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
  const { result } = renderHook(() => ({ closes: useEodCloses(VENUE), actions: useEodActions(VENUE) }), { wrapper });
  return { result, calls };
}

afterEach(cleanup);

describe('End-of-day closes', () => {
  it('gives each figure counted, expected and its variance, and an anomaly waiting for its review', async () => {
    const { result } = renderEod({ eod_closes: { body: [SHORT] } });
    await waitFor(() => expect(result.current.closes.data?.[0]).toMatchObject({
      closeId: 'c1', float: 120_600_000n, closedBy: 'Sana Qureshi', mayReview: true, isAnomaly: true, review: null,
      cash: { counted: 120_550_000n, expected: 120_600_000n, variance: -50_000n },
      chips: { counted: 62_400_000n, expected: 62_400_000n, variance: 0n },
    }));
  });

  it('gives a reviewed anomaly\'s reason and who gave it', async () => {
    const reviewed = { ...SHORT, reason: 'A note paid out twice', reviewed_by: 'Aditya Malhotra', reviewed_at: '2026-10-21T03:00:00Z' };
    const { result } = renderEod({ eod_closes: { body: [reviewed] } });
    await waitFor(() => expect(result.current.closes.data?.[0]?.review).toEqual({
      reason: 'A note paid out twice', reviewedBy: 'Aditya Malhotra', reviewedAt: '2026-10-21T03:00:00Z',
    }));
  });
});

describe('The end of day\'s steps', () => {
  it('closes the shift with the cash, receipts, markers and chips, once per request id', async () => {
    const { result, calls } = renderEod({ close_cage_shift: { body: 'c2' } });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.actions.close.mutateAsync({
        cash: fromPaise(120_600_000n), receipts: fromPaise(2_000_000n), markers: fromPaise(5_000_000n),
        counts: [{ value: fromPaise(5000n), quantity: 400 }], requestId: 'r1',
      });
    });
    expect(outcome).toEqual({ ok: true, value: 'c2' });
    expect(calls.find((call) => call.rpc === 'close_cage_shift')?.body).toEqual({
      p_venue_id: VENUE, p_cash_paise: 120600000, p_receipts_paise: 2000000, p_markers_paise: 5000000,
      p_counts: [{ value_paise: 5000, quantity: 400 }], p_idempotency_key: 'r1',
    });
  });

  it.each([['RVREV', 'no_review'], ['42501', 'not_allowed'], ['22023', 'invalid'], ['RVNSH', 'no_shift'], ['XX000', 'unavailable']])(
    'says why a review is refused: %s is %s', async (code, failure) => {
      const { result } = renderEod({ review_eod_close: { status: 400, body: { code, message: 'refused' } } });
      let outcome: unknown;
      await act(async () => {
        outcome = await result.current.actions.review.mutateAsync({ closeId: 'c1', reason: 'A note paid out twice' });
      });
      expect(outcome).toEqual({ ok: false, error: failure });
    },
  );
});

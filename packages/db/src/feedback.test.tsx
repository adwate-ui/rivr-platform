import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { toDoorScan, useDoorScan } from './door.ts';
import { useFeedbackActions, useMyFeedbackVisit, useResolveFeedback, useVenueFeedback } from './feedback.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const SIGNED_IN = '00000000-0000-4000-8000-000000000213';
const VENUE = '00000000-0000-4000-8000-000000000001';

/** A fake API: each path answers with its reply; every call is kept with what it sent. */
function renderHooks(replies: Record<string, { status?: number; body: unknown }>) {
  const calls: { url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const path = Object.keys(replies).find((key) => url.includes(key));
    const reply = path ? replies[path] : undefined;
    return Response.json(reply?.body ?? null, { status: reply?.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(SIGNED_IN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({
    visit: useMyFeedbackVisit(), actions: useFeedbackActions(), list: useVenueFeedback(VENUE), resolve: useResolveFeedback(VENUE), scan: useDoorScan(),
  }), { wrapper });
  return { result, calls };
}

afterEach(cleanup);

describe('feedback (decision 0165)', () => {
  it('reads the visit Home asks about, rates it and sends a note, each trimmed', async () => {
    const { result, calls } = renderHooks({
      '/rpc/my_feedback_visit': { body: [{ visit_id: 'v1', closed_at: '2026-10-25T18:00:00Z' }] },
      '/rpc/rate_visit': { body: 'f1' },
      '/rpc/send_feedback': { status: 400, body: { code: 'RVFRZ', message: 'frozen' } },
      '/rpc/venue_feedback': { body: [] },
    });
    await waitFor(() => expect(result.current.visit.data).toEqual({ visitId: 'v1', closedAt: '2026-10-25T18:00:00Z' }));
    let outcome: unknown;
    await act(async () => { outcome = await result.current.actions.rate.mutateAsync({ visitId: 'v1', score: 2, note: '  Slow dealer ' }); });
    expect(outcome).toEqual({ ok: true, value: null });
    expect(calls.find((call) => call.url.includes('/rpc/rate_visit'))?.body).toEqual({ p_visit_id: 'v1', p_score: 2, p_note: 'Slow dealer' });
    await act(async () => { outcome = await result.current.actions.send.mutateAsync(' PLO on Mondays '); });
    expect(outcome).toEqual({ ok: false, error: 'paused' });
  });

  it('lists the venue\'s feedback for the General Manager and resolves a ticket', async () => {
    const { result } = renderHooks({
      '/rpc/my_feedback_visit': { body: [] },
      '/rpc/venue_feedback': {
        body: [{
          id: 'f1', member_id: 'm1', full_name: 'Mihir Shah', member_number: 1213, visit_closed_at: '2026-10-25T18:00:00Z', score: 2,
          note: 'Slow dealer', is_ticket: true, resolved_at: null, resolved_by: null, resolution: null, created_at: '2026-10-26T04:00:00Z',
        }],
      },
      '/rpc/resolve_feedback': { status: 400, body: { code: '22023', message: 'resolved' } },
    });
    await waitFor(() => expect(result.current.list.data?.[0]).toMatchObject({ fullName: 'Mihir Shah', score: 2, isTicket: true, resolvedAt: null }));
    expect(result.current.visit.data).toBeNull();
    let outcome: unknown;
    await act(async () => { outcome = await result.current.resolve.mutateAsync({ feedbackId: 'f1', resolution: 'Called him' }); });
    expect(outcome).toEqual({ ok: false, error: 'invalid' });
  });

  it('sends the quick note with its topic and the detailed form with its answers, and reads them back', async () => {
    const { result, calls } = renderHooks({
      '/rpc/my_feedback_visit': { body: [] },
      '/rpc/send_quick_feedback': { body: 'f2' },
      '/rpc/send_detailed_feedback': { status: 400, body: { code: '22023', message: 'ratings' } },
      '/rpc/venue_feedback': {
        body: [{
          id: 'f3', member_id: 'm1', full_name: 'Mihir Shah', member_number: 1213, visit_closed_at: null, score: null, note: null, is_ticket: true,
          resolved_at: null, resolved_by: null, resolution: null, created_at: '2026-10-29T04:00:00Z', topic: null,
          ratings: { gameplay: 5, cashier: 3, service: 4, ambience: 5 }, nps: 9,
        }],
      },
    });
    let outcome: unknown;
    await act(async () => { outcome = await result.current.actions.sendQuick.mutateAsync({ topic: 'dealer', note: ' Quick and fair ' }); });
    expect(outcome).toEqual({ ok: true, value: null });
    expect(calls.find((call) => call.url.includes('/rpc/send_quick_feedback'))?.body).toEqual({ p_topic: 'dealer', p_note: 'Quick and fair' });
    const ratings = { gameplay: 5, cashier: 3, service: 4, ambience: 5 };
    await act(async () => { outcome = await result.current.actions.sendDetailed.mutateAsync({ ratings, nps: 9, note: '' }); });
    expect(outcome).toEqual({ ok: false, error: 'invalid' });
    expect(calls.find((call) => call.url.includes('/rpc/send_detailed_feedback'))?.body).toEqual({ p_ratings: ratings, p_nps: 9, p_note: '' });
    await waitFor(() => expect(result.current.list.data?.[0]).toMatchObject({ topic: null, ratings, nps: 9 }));
  });
});

describe('the door kiosk (decision 0164)', () => {
  it('reads what a scan did', () => {
    expect(toDoorScan({ action: 'in', first_name: 'Kavya', played_seconds: 0 })).toEqual({ action: 'in', firstName: 'Kavya' });
    expect(toDoorScan({ action: 'out', first_name: 'Mihir', played_seconds: 16200 })).toEqual({ action: 'out', firstName: 'Mihir', playedSeconds: 16200 });
    expect(toDoorScan({ action: 'what', first_name: 'Mihir', played_seconds: 0 })).toBeNull();
    expect(toDoorScan(undefined)).toBeNull();
  });

  it('scans a card, and says why a scan did nothing, with the call time owed', async () => {
    const { result, calls } = renderHooks({
      '/rpc/my_feedback_visit': { body: [] },
      '/rpc/venue_feedback': { body: [] },
      '/rpc/door_scan': { status: 400, body: { code: 'RVCTS', message: 'owed', details: '1500' } },
    });
    let outcome: unknown;
    await act(async () => { outcome = await result.current.scan.mutateAsync(' code '); });
    expect(outcome).toEqual({ ok: false, error: { reason: 'call_time_owed', owedSeconds: 1500 } });
    expect(calls.find((call) => call.url.includes('/rpc/door_scan'))?.body).toEqual({ p_code: 'code' });
  });
});

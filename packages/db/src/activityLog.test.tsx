import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useActivityLog, type ActivityFilters } from './activityLog.ts';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const STAFF = '00000000-0000-4000-8000-000000000101';
const VENUE = '00000000-0000-4000-8000-000000000001';
const NONE: ActivityFilters = { from: null, to: null, who: null, kind: null };

const line = (id: number, kind = 'staff') => ({
  id, occurred_at: `2026-11-03T08:${String(id % 60).padStart(2, '0')}:00Z`, who: 'Vikram Rao', is_system: false, action: 'update', entity: 'staff', kind, about: 'Pema Lepcha', reason: null, amount: null,
});

/** The hook over a fake API: `reply` answers each read, and what each was sent is kept. */
function renderLog(filters: ActivityFilters, reply: (body: Record<string, unknown>) => unknown[]) {
  const sent: Record<string, unknown>[] = [];
  const fetch: typeof globalThis.fetch = async (_input, init) => {
    const parsed: unknown = JSON.parse(String(init?.body));
    const body = typeof parsed === 'object' && parsed !== null ? Object.fromEntries(Object.entries(parsed)) : {};
    sent.push(body);
    return Response.json(reply(body));
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(STAFF), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => useActivityLog(VENUE, filters), { wrapper });
  return { result, sent };
}

afterEach(cleanup);

describe('useActivityLog (F-034)', () => {
  it('sends only the filters chosen, and turns a row into a line', async () => {
    const { result, sent } = renderLog({ from: '2026-11-01', to: '2026-11-03', who: 'Vikram', kind: 'staff' }, () => [line(1)]);
    await waitFor(() => expect(result.current.data?.pages[0]?.[0]).toMatchObject({
      id: 1, occurredAt: '2026-11-03T08:01:00Z', who: 'Vikram Rao', isSystem: false, kind: 'staff', about: 'Pema Lepcha', reason: null, amount: null,
    }));
    expect(sent[0]).toEqual({ p_venue_id: VENUE, p_limit: 50, p_from: '2026-11-01', p_to: '2026-11-03', p_who: 'Vikram', p_kind: 'staff' });
  });

  it('gives how much was given', async () => {
    const { result } = renderLog(NONE, () => [{ ...line(1, 'points'), action: 'points.grant', amount: 500 }]);
    await waitFor(() => expect(result.current.data?.pages[0]?.[0]?.amount).toBe(500));
  });

  it('calls a kind it does not know other', async () => {
    const { result } = renderLog(NONE, () => [line(1, 'something_new')]);
    await waitFor(() => expect(result.current.data?.pages[0]?.[0]?.kind).toBe('other'));
  });

  it('goes on from the last line of a full page, and stops after a short one', async () => {
    const full = Array.from({ length: 50 }, (_, index) => line(100 - index));
    const { result, sent } = renderLog(NONE, (body) => (body['p_before_id'] === undefined ? full : [line(7)]));
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    await act(async () => { await result.current.fetchNextPage(); });
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(sent[1]).toEqual({ p_venue_id: VENUE, p_limit: 50, p_before: full[49]?.occurred_at, p_before_id: 51 });
    expect(result.current.hasNextPage).toBe(false);
  });

  it('gives no more pages after an empty one', async () => {
    const { result } = renderLog(NONE, () => []);
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));
    expect(result.current.hasNextPage).toBe(false);
  });

  it('fails when the read fails', async () => {
    const fails: typeof globalThis.fetch = async () => Response.json({ message: 'no', code: '42501' }, { status: 403 });
    const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
      global: { fetch: fails },
      auth: { storage: sessionStorageFor(STAFF), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
    const { result } = renderHook(() => useActivityLog(VENUE, NONE), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 8000 });
  });
});

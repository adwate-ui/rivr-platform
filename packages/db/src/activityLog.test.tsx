import { createClient } from '@supabase/supabase-js';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useActivityPage, type ActivityFilters } from './activityLog.ts';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const STAFF = '00000000-0000-4000-8000-000000000101';
const VENUE = '00000000-0000-4000-8000-000000000001';
const NONE: ActivityFilters = { from: null, to: null, who: null, kind: null };

const line = (id: number, kind = 'staff') => ({
  total: 1200, id, occurred_at: `2026-11-03T08:${String(id % 60).padStart(2, '0')}:00Z`, who: 'Vikram Rao', is_system: false, action: 'update', entity: 'staff', kind,
  about: 'Pema Lepcha', reason: null, amount: null,
});

/** The hook over a fake API: `reply` answers each read, and what each was sent is kept. */
function renderLog(filters: ActivityFilters, reply: (body: Record<string, unknown>) => unknown[], page = 1) {
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
  const { result } = renderHook(() => useActivityPage(VENUE, filters, page), { wrapper });
  return { result, sent };
}

afterEach(cleanup);

describe('useActivityPage (F-034; pages by number, redesign RD-31)', () => {
  it('sends only the filters chosen and the page by its number, and turns a row into a line with how many there are', async () => {
    const { result, sent } = renderLog({ from: '2026-11-01', to: '2026-11-03', who: 'Vikram', kind: 'staff' }, () => [line(1)], 3);
    await waitFor(() => expect(result.current.data?.lines[0]).toMatchObject({
      id: 1, occurredAt: '2026-11-03T08:01:00Z', who: 'Vikram Rao', isSystem: false, kind: 'staff', about: 'Pema Lepcha', reason: null, amount: null,
    }));
    expect(result.current.data?.total).toBe(1200);
    expect(sent[0]).toEqual({ p_venue_id: VENUE, p_page: 3, p_page_size: 50, p_from: '2026-11-01', p_to: '2026-11-03', p_who: 'Vikram', p_kind: 'staff' });
  });

  it('gives how much was given', async () => {
    const { result } = renderLog(NONE, () => [{ ...line(1, 'bonus_chips'), action: 'bonus.grant', amount: 1500 }]);
    await waitFor(() => expect(result.current.data?.lines[0]?.amount).toBe(1500));
  });

  it('calls a kind it does not know other, and reads a choice that leaves nothing as none', async () => {
    const { result } = renderLog(NONE, () => [line(1, 'something_new')]);
    await waitFor(() => expect(result.current.data?.lines[0]?.kind).toBe('other'));
    const nothing = renderLog({ ...NONE, who: 'nobody' }, () => []);
    await waitFor(() => expect(nothing.result.current.data).toEqual({ lines: [], total: 0 }));
  });

  it('reads every line the narrowing leaves for an export, a thousand at a time', async () => {
    const page = (count: number) => Array.from({ length: count }, (_, index) => line(index));
    const { result, sent } = renderLog({ ...NONE, kind: 'staff' }, (body) => (body['p_page_size'] === 50 ? page(50) : body['p_page'] === 1 ? page(1000) : page(200)));
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(await result.current.readEvery()).toHaveLength(1200);
    expect(sent.filter((body) => body['p_page_size'] === 1000).map((body) => [body['p_page'], body['p_kind']])).toEqual([[1, 'staff'], [2, 'staff']]);
  });
});

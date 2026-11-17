import { createClient } from '@supabase/supabase-js';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useDoorPage } from './door.ts';
import { listViewJson, useListChoices, type ScopedView } from './lists.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const STAFF = '00000000-0000-4000-8000-000000000110';
const VENUE = '00000000-0000-4000-8000-000000000001';

const VIEW: ScopedView = {
  sort: { key: 'played', direction: 'descending' }, query: 'kapoor', page: 2, scope: { list: 'in_club' },
  filters: { status: { kind: 'choice', chosen: ['playing'] }, played: { kind: 'range', min: '1', max: '' } },
};

const NAINA = {
  total: 318, member_id: 'm1', full_name: 'Naina Kapoor', member_number: 270, tier_name: 'Black card', is_base_tier: false, status: 'playing', list: 'in_club',
  checked_in_at: '2026-11-15T15:34:00Z', checked_out_at: null, waiting_seconds: 300, tables: [{ table: 'Table 1', seconds: 5400 }, { nonsense: true }],
  played_seconds: 5400, kyc_status: 'verified', since: '2026-11-15T15:34:00Z', bonus_paise: 50_000,
};

/** A fake API that answers each RPC by name and keeps what it was sent. */
function fakeApi(replies: Record<string, readonly object[]>) {
  const calls: { rpc: string; body: Record<string, unknown> }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const rpc = (input instanceof Request ? input.url : String(input)).split('/rpc/')[1]?.split('?')[0] ?? '';
    const body: Record<string, unknown> = init?.body ? JSON.parse(String(init.body)) : {};
    calls.push({ rpc, body });
    return Response.json(replies[rpc] ?? []);
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(STAFF), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  return { calls, wrapper };
}

afterEach(cleanup);

describe('lists read a page at a time from the server (redesign RD-30)', () => {
  it('writes a view as the server reads it: the order, the search, each filter, the screen\'s own choice and the page', () => {
    expect(listViewJson(VIEW)).toEqual({
      query: 'kapoor', sort: { key: 'played', direction: 'descending' }, scope: { list: 'in_club' }, page: 2, page_size: 50,
      filters: { status: { kind: 'choice', chosen: ['playing'] }, played: { kind: 'range', min: '1', max: '' } },
    });
    // No order chosen, no choice of the screen's, and an export's page of a thousand.
    expect(listViewJson({ sort: null, query: '', filters: {}, page: 1 }, 3, 1000)).toEqual({ query: '', sort: null, filters: {}, scope: {}, page: 3, page_size: 1000 });
  });

  it('asks for one page of the door\'s list and reads each player and how many the view leaves', async () => {
    const { calls, wrapper } = fakeApi({ door_page: [NAINA, { ...NAINA, member_id: 'm2', status: 'a word of another day', list: 'elsewhere', kyc_status: 'pending', since: null }] });
    const { result } = renderHook(() => useDoorPage(VENUE, VIEW), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(calls).toEqual([{ rpc: 'door_page', body: { p_venue_id: VENUE, p_view: listViewJson(VIEW) } }]);
    expect(result.current.data?.total).toBe(318);
    expect(result.current.data?.rows[0]).toEqual({
      memberId: 'm1', fullName: 'Naina Kapoor', memberNumber: 270, tierName: 'Black card', isBaseTier: false, status: 'playing', list: 'in_club',
      checkedInAt: '2026-11-15T15:34:00Z', checkedOutAt: null, waitingSeconds: 300, tables: [{ table: 'Table 1', seconds: 5400 }], playedSeconds: 5400,
      kycStatus: 'verified', since: '2026-11-15T15:34:00Z', bonus: 50_000n,
    });
    // Words this console does not know never read as in the club, nor as checked.
    expect(result.current.data?.rows[1]).toMatchObject({ status: 'left', list: 'not_arrived', kycStatus: 'not_done', since: null });
  });

  it('asks nothing until the table has handed its view over, and reads a view that leaves nobody as none', async () => {
    const { calls, wrapper } = fakeApi({});
    const waiting = renderHook(() => useDoorPage(VENUE, null), { wrapper });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(calls).toEqual([]);
    expect(waiting.result.current.data).toBeUndefined();
    const { result } = renderHook(() => useDoorPage(VENUE, { ...VIEW, page: 1 }), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual({ rows: [], total: 0 }));
  });

  it('reads what a list\'s menus and chips offer, by column, whatever the page and order', async () => {
    const { calls, wrapper } = fakeApi({ list_choices: [
      { column_key: 'list', value: 'in_club', members: 36 }, { column_key: 'list', value: 'left', members: 279 }, { column_key: 'tier', value: 'Member', members: 290 },
    ] });
    const { result } = renderHook(() => useListChoices('door', VENUE, VIEW), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual({ list: [{ value: 'in_club', count: 36 }, { value: 'left', count: 279 }], tier: [{ value: 'Member', count: 290 }] });
    expect(calls).toEqual([{ rpc: 'list_choices', body: { p_list: 'door', p_venue_id: VENUE, p_view: { ...listViewJson(VIEW), sort: null, page: 1 } } }]);
  });

  it('reads every row a view leaves for an export, a thousand at a time, until the total is reached', async () => {
    const calls: number[] = [];
    const page = (count: number) => Array.from({ length: count }, (_, at) => ({ ...NAINA, total: 1200, member_id: `m${String(at)}` }));
    const fetch: typeof globalThis.fetch = async (_input, init) => {
      const asked: { p_view: { page: number; page_size: number } } = JSON.parse(String(init?.body));
      calls.push(asked.p_view.page_size);
      return Response.json(asked.p_view.page_size === 50 ? page(50) : asked.p_view.page === 1 ? page(1000) : page(200));
    };
    const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
      global: { fetch }, auth: { storage: sessionStorageFor(STAFF), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
    const { result } = renderHook(() => useDoorPage(VENUE, VIEW), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(await result.current.readEvery()).toHaveLength(1200);
    expect(calls.filter((size) => size === 1000)).toHaveLength(2);
  });
});

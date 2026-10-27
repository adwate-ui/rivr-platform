import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useFnbActions, useFnbItems, useFnbMenu, useFnbOrdersTonight, useMyFnbMenu, usePlaceFnbOrder, useTabletFnbOrder } from './fnb.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const SIGNED_IN = '00000000-0000-4000-8000-000000000103';
const VENUE = '00000000-0000-4000-8000-000000000001';
const CHAI = '00000000-0000-4000-8000-0000000f1001';

/** A fake API: each path answers with its reply. */
function renderFnb(replies: Record<string, { status?: number; body: unknown }>) {
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
    mine: useMyFnbMenu(), menu: useFnbMenu(VENUE), place: usePlaceFnbOrder(), tablet: useTabletFnbOrder(),
    tonight: useFnbOrdersTonight(VENUE), actions: useFnbActions(VENUE), items: useFnbItems(VENUE),
  }), { wrapper });
  return { result, calls };
}

const MENU = [{ item_id: CHAI, name: 'Masala chai', kind: 'soft_drink' }];
const LINES = [{ item_id: CHAI, quantity: 2, note: 'Less sugar' }];

afterEach(cleanup);

describe('table-side food and drink', () => {
  it('reads the member\'s menu, the venue\'s, its items and tonight\'s orders', async () => {
    const { result } = renderFnb({
      '/rpc/my_fnb_menu': { body: MENU },
      '/rpc/fnb_menu': { body: MENU },
      '/rest/v1/fnb_item': { body: [{ id: CHAI, name: 'Masala chai', kind: 'soft_drink', is_available: false, position: 1 }] },
      '/rpc/fnb_orders_tonight': {
        body: [{
          order_id: 'o1', kot_number: 3, table_name: 'Table 3', seat: 5, member_name: 'Yash Gupta', member_number: 1043,
          lines: [{ item_id: CHAI, name: 'Masala chai', kind: 'soft_drink', quantity: 2, note: null }], is_comp: true, source: 'console',
          created_at: '2026-11-15T16:30:00Z', kot_sent_at: null, kot_sent_by: null,
        }],
      },
    });
    const chai = { itemId: CHAI, name: 'Masala chai', kind: 'soft_drink' };
    await waitFor(() => expect(result.current.mine.data).toEqual([chai]));
    await waitFor(() => expect(result.current.menu.data).toEqual([chai]));
    await waitFor(() => expect(result.current.items.data).toEqual([{ ...chai, isAvailable: false, position: 1 }]));
    await waitFor(() => expect(result.current.tonight.data).toEqual([{
      orderId: 'o1', kotNumber: 3, tableName: 'Table 3', seat: 5, memberName: 'Yash Gupta', memberNumber: 1043,
      lines: [{ name: 'Masala chai', quantity: 2, note: null }], isComp: true, source: 'console', createdAt: '2026-11-15T16:30:00Z', kotSentBy: null,
    }]));
  });

  it('places an order from the app and the tablet, giving the KOT, and says why not', async () => {
    const { result, calls } = renderFnb({ '/rpc/place_fnb_order': { body: [{ order_id: 'o1', kot_number: 7 }] }, '/rpc/tablet_fnb_order': {
      status: 400, body: { code: 'RVFNS', message: 'Nobody sits in that seat' },
    } });
    let placed: unknown;
    await act(async () => { placed = await result.current.place.mutateAsync(LINES); });
    expect(placed).toEqual({ ok: true, value: { orderId: 'o1', kotNumber: 7 } });
    expect(calls.find((call) => call.url.includes('/rpc/place_fnb_order'))?.body).toEqual({ p_lines: LINES });
    let refused: unknown;
    await act(async () => { refused = await result.current.tablet.mutateAsync({ seat: 9, lines: [{ item_id: CHAI, quantity: 1 }] }); });
    expect(refused).toEqual({ ok: false, error: 'not_seated' });
    expect(calls.find((call) => call.url.includes('/rpc/tablet_fnb_order'))?.body).toEqual({ p_seat: 9, p_lines: [{ item_id: CHAI, quantity: 1, note: null }] });
  });

  it('orders a comp from the console, marks a KOT given by hand, and keeps the menu', async () => {
    const { result, calls } = renderFnb({
      '/rpc/console_fnb_order': { body: [{ order_id: 'o2', kot_number: 8 }] },
      '/rpc/mark_kot_sent': { status: 403, body: { code: '42501', message: 'no' } },
      '/rpc/save_fnb_item': { body: CHAI },
      // What each action reloads.
      '/rpc/fnb_orders_tonight': { body: [] },
      '/rest/v1/fnb_item': { body: [] },
    });
    await act(async () => { await result.current.actions.order.mutateAsync({ tableId: 't3', seat: 5, lines: LINES, isComp: true }); });
    expect(calls.find((call) => call.url.includes('/rpc/console_fnb_order'))?.body).toEqual({
      p_venue_id: VENUE, p_table_id: 't3', p_seat: 5, p_lines: LINES, p_is_comp: true,
    });
    let marked: unknown;
    await act(async () => { marked = await result.current.actions.markSent.mutateAsync('o1'); });
    expect(marked).toEqual({ ok: false, error: 'not_allowed' });
    await act(async () => {
      await result.current.actions.saveItem.mutateAsync({ itemId: null, name: ' Cold coffee ', kind: 'soft_drink', isAvailable: true, position: 4 });
      await result.current.actions.saveItem.mutateAsync({ itemId: CHAI, name: 'Masala chai', kind: 'soft_drink', isAvailable: false, position: 1 });
    });
    const saves = calls.filter((call) => call.url.includes('/rpc/save_fnb_item')).map((call) => call.body);
    expect(saves).toEqual([
      { p_venue_id: VENUE, p_name: 'Cold coffee', p_kind: 'soft_drink', p_is_available: true, p_position: 4 },
      { p_venue_id: VENUE, p_name: 'Masala chai', p_kind: 'soft_drink', p_is_available: false, p_position: 1, p_item_id: CHAI },
    ]);
  });
});

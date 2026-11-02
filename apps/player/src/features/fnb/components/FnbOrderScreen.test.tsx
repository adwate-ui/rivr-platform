import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FnbOrderScreen } from './FnbOrderScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** Signed in on the Menu, with the feature map on its way for good, or failing once and then giving table-side food. */
function renderMenu(map: 'on its way' | 'fails once') {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000211', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  let asked = 0;
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.includes('/rpc/my_feature_access')) return Response.json([]);
    if (map === 'on its way') return new Promise<Response>(() => undefined);
    if (asked++ === 0) return Response.json({ message: 'unavailable' }, { status: 503 });
    return Response.json([{ feature_key: 'fnb.table_side', state: 'enabled', tiers: null }]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <FnbOrderScreen />
    </RivrDataProvider>,
  );
}

describe('the Menu, while the feature map loads or fails (a weak signal in the club)', () => {
  it('says it is loading while the map is on its way', async () => {
    renderMenu('on its way');
    expect(await screen.findByRole('heading', { level: 1, name: 'Menu' })).toBeDefined();
    expect(screen.getByText('Loading')).toBeDefined();
  });

  it('says it could not load when the map fails, and loads on Try again', async () => {
    renderMenu('fails once');
    expect(await screen.findByText('Not loaded. Try again.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.queryByText('Not loaded. Try again.')).toBeNull());
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });
});

/** my_seat's answer: never, no seat, or Table 3, seat 5. */
function seatReply(seat: 'on its way' | 'seated' | 'not seated'): Promise<Response> | Response {
  if (seat === 'on its way') return new Promise<Response>(() => undefined);
  if (seat === 'not seated') return Response.json([]);
  return Response.json([{ table_name: 'Table 3', seat: 5, is_away: false, has_call_time: false, call_time_left: null, played_seconds: 600, is_leaving: false, top_up: null, call_time_minutes: null,
    started_at: '2026-11-15T16:55:00Z', call_time_ends_at: null, table_type_name: 'NLH 100/200', small_blind_paise: 10000, big_blind_paise: 20000 }]);
}

/** Signed in with table-side food, the seat answering as given, a chai on the menu, and orders whose first reply is lost. */
function renderOrdering(seat: 'on its way' | 'seated' | 'not seated', myOrders: readonly object[] = []) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000211', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const orders: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/my_feature_access')) return Response.json([{ feature_key: 'fnb.table_side', state: 'enabled', tiers: null }]);
    if (url.includes('/rpc/my_seat')) return seatReply(seat);
    if (url.includes('/rpc/my_fnb_menu')) {
      return Response.json([{ item_id: 'chai', name: 'Masala chai', kind: 'soft_drink', photo_path: 'v1/menu-chai.jpg' }, { item_id: 'sandwich', name: 'Club sandwich', kind: 'food', photo_path: null }]);
    }
    if (url.includes('/rpc/my_fnb_orders')) return Response.json(myOrders);
    if (url.includes('/rpc/place_fnb_order')) {
      orders.push(JSON.parse(String(init?.body)));
      // The first reply is lost on a weak signal; the order went through.
      return orders.length === 1 ? Response.json({ message: 'unreachable' }, { status: 503 }) : Response.json([{ order_id: 'o1', kot_number: 7 }]);
    }
    return Response.json([]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <FnbOrderScreen />
    </RivrDataProvider>,
  );
  return orders;
}

describe('ordering at the seat', () => {
  it('says an order staff voided is cancelled, and why (decision 0302)', async () => {
    renderOrdering('seated', [{ order_id: 'o1', kot_number: 7, lines: [{ name: 'Masala chai', quantity: 1, note: null }], created_at: '2026-11-15T16:10:00Z',
      accepted_at: null, delivered_at: null, cancelled_at: '2026-11-15T16:12:00Z', cancel_reason: 'Out of milk' }]);
    expect(await screen.findByText('Cancelled: Out of milk', {}, { timeout: 5000 })).toBeDefined();
  });

  it('lists the menu under its sections, food first, before the member sits, with nothing to order yet', async () => {
    renderOrdering('not seated');
    expect(await screen.findByText('Take a seat to order.', {}, { timeout: 5000 })).toBeDefined();
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(['Food', 'Soft drinks', 'Your orders tonight']);
    expect(screen.getByText('Masala chai')).toBeDefined();
    // The club's photo of the chai beside its name (AS-11); the sandwich, with none, shows its initial.
    expect(screen.getAllByRole('presentation', { hidden: true }).map((image) => image.getAttribute('src')))
      .toEqual(['http://127.0.0.1:9/storage/v1/object/public/item-photos/v1/menu-chai.jpg']);
    expect(screen.queryByRole('button', { name: 'One more Masala chai' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send to the bar' })).toBeNull();
  });

  it('groups what the seated member orders the same way', async () => {
    renderOrdering('seated');
    expect(await screen.findByRole('button', { name: 'One more Club sandwich' }, { timeout: 5000 })).toBeDefined();
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(['Food', 'Soft drinks', 'Your orders tonight']);
  });

  it('says it is loading while the seat is read, not to sit at a table first', async () => {
    renderOrdering('on its way');
    // The Menu itself is drawn, past its feature check: the seat's own line is what follows.
    expect(await screen.findByRole('heading', { name: 'Your orders tonight' })).toBeDefined();
    expect(screen.getAllByText('Loading').length).toBeGreaterThan(0);
    expect(screen.queryByText('Take a seat to order.')).toBeNull();
  });

  it('sends the same request id again after a lost reply, so the bar gets one KOT', async () => {
    const orders = renderOrdering('seated');
    // The menu comes after the feature or device read: on a busy machine, more than a second.
    fireEvent.click(await screen.findByRole('button', { name: 'One more Masala chai' }, { timeout: 5000 }));
    fireEvent.click(screen.getByRole('button', { name: 'Send to the bar' }));
    expect(await screen.findByRole('alert')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Send to the bar' }));
    expect(await screen.findByText('Sent to the bar. Order 7.')).toBeDefined();
    expect(orders).toHaveLength(2);
    const [first, second] = orders.map((order) => Reflect.get(Object(order), 'p_idempotency_key'));
    expect(first).toEqual(expect.any(String));
    expect(second).toBe(first);
  });
});

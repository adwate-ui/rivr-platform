import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SeatFnbOrder } from './SeatFnbOrder.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** Tablet A at Table 3, a chai on the menu, and orders whose first reply is lost on a weak signal. */
function renderOrder() {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-00000000e001', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const orders: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/my_device')) {
      return Response.json([{ device_id: 'd1', venue_id: 'v1', name: 'Tablet A', kind: 'dealer_tablet', table_id: 't3', table_name: 'Table 3', is_practice: false }]);
    }
    if (url.includes('/rpc/fnb_menu')) return Response.json([{ item_id: 'chai', name: 'Masala chai', kind: 'soft_drink' , photo_path: null }]);
    if (url.includes('/rpc/tablet_fnb_order')) {
      orders.push(JSON.parse(String(init?.body)));
      return orders.length === 1 ? Response.json({ message: 'unreachable' }, { status: 503 }) : Response.json([{ order_id: 'o1', kot_number: 9 }]);
    }
    return Response.json([]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SeatFnbOrder seat={5} onClose={() => undefined} />
    </RivrDataProvider>,
  );
  return orders;
}

describe('a dealer orders for a seat', () => {
  it('sends the same request id again after a lost reply, so the bar gets one KOT, and a new one once the order changes', async () => {
    const orders = renderOrder();
    // The menu comes after the feature or device read: on a busy machine, more than a second.
    fireEvent.click(await screen.findByRole('button', { name: 'One more Masala chai' }, { timeout: 5000 }));
    fireEvent.click(screen.getByRole('button', { name: 'Send to the bar' }));
    expect(await screen.findByRole('alert')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Send to the bar' }));
    expect(await screen.findByText('Sent to the bar: KOT 9.')).toBeDefined();
    const keys = orders.map((order) => Reflect.get(Object(order), 'p_idempotency_key'));
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
    fireEvent.click(screen.getByRole('button', { name: 'One more Masala chai' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send to the bar' }));
    await screen.findByText('Sent to the bar: KOT 9.');
    await vi.waitFor(() => expect(orders).toHaveLength(3));
    expect(Reflect.get(Object(orders[2]), 'p_idempotency_key')).not.toBe(keys[0]);
  });
});

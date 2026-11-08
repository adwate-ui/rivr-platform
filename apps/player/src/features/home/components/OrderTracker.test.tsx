import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { ToastProvider } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrderTracker } from './OrderTracker.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'onLine');
});

const ORDER = {
  order_id: 'o1', kot_number: 12, lines: [{ item_id: 'chai', name: 'Masala chai', quantity: 1, note: null }], created_at: '2026-11-15T17:00:00Z',
  cancelled_at: null, cancel_reason: null, accepted_at: null, on_way_at: null, delivered_at: null,
};
const LATER = { timeout: 5000 };

const ACCEPTED = { ...ORDER, accepted_at: '2026-11-15T17:01:00Z' };
const CANCELLED = { ...ORDER, cancelled_at: '2026-11-15T17:01:00Z', cancel_reason: 'Cancelled by the member' };

/** A member at their seat with `order` tonight, which reads as `afterCancel` once a cancel was sent; it answers with `cancelReply`, and each is kept. */
function renderTracker(order: object, cancelReply: () => Response = () => new Response(null, { status: 204 }), afterCancel: object = order) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000231', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const cancelled: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/my_feature_access')) return Response.json([{ feature_key: 'fnb.table_side', state: 'enabled', tiers: null }]);
    if (url.includes('/rpc/my_fnb_orders')) return Response.json([cancelled.length === 0 ? order : afterCancel]);
    if (url.includes('/rpc/cancel_my_fnb_order')) {
      cancelled.push(JSON.parse(String(init?.body)));
      return cancelReply();
    }
    return Response.json([]);
  });
  const rootRoute = createRootRoute({ component: OrderTracker });
  const router = createRouter({ routeTree: rootRoute, history: createMemoryHistory({ initialEntries: ['/'] }) });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider><RouterProvider router={router} /></ToastProvider>
    </RivrDataProvider>,
  );
  return cancelled;
}

describe('Tonight › the order at the seat (F-048)', () => {
  it('offers Cancel while the order is Sent, asks once more, and cancels it', async () => {
    const cancelled = renderTracker(ORDER, undefined, CANCELLED);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel order' }, LATER));
    expect(cancelled).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel it' }));
    await waitFor(() => expect(cancelled).toEqual([{ p_order_id: 'o1' }]));
    expect(await screen.findByText('Order cancelled', {}, LATER)).toBeDefined();
  });

  it('says so in a toast when the bar accepted it first, after the reload has taken Cancel away', async () => {
    renderTracker(ORDER, () => Response.json({ code: '22023', message: 'The bar has accepted that order' }, { status: 400 }), ACCEPTED);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel order' }, LATER));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel it' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Cancel order' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Yes, cancel it' })).toBeNull();
    }, LATER);
    expect(await screen.findByText('The bar has started it.', {}, LATER)).toBeDefined();
  });

  it('says so in a toast when the cancel did not go through', async () => {
    renderTracker(ORDER, () => Response.json({ code: 'XX000', message: 'down' }, { status: 500 }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel order' }, LATER));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel it' }));
    expect(await screen.findByText('Not sent. Try again.', {}, LATER)).toBeDefined();
  });

  it('offers no Cancel once the bar has accepted it', async () => {
    renderTracker(ACCEPTED);
    expect(await screen.findByText('Masala chai', {}, LATER)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Cancel order' })).toBeNull();
  });

  it('holds Cancel back with no connection', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    renderTracker(ORDER);
    expect(await screen.findByRole('button', { name: 'Cancel order' }, LATER)).toHaveProperty('disabled', true);
  });

  it('says the member cancelled it, in their words, and offers Order again', async () => {
    renderTracker(CANCELLED);
    expect(await screen.findByText('You cancelled this order.', {}, LATER)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Order again' })).toBeDefined();
  });

  it('still gives the reason when staff voided it', async () => {
    renderTracker({ ...ORDER, cancelled_at: '2026-11-15T17:01:00Z', cancel_reason: 'Out of chai' });
    expect(await screen.findByText('Cancelled: Out of chai', {}, LATER)).toBeDefined();
  });
});

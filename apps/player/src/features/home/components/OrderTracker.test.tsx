import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
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

/** A member at their seat with `order` tonight; the cancel answers with `cancelReply`, and each is kept. */
function renderTracker(order: object, cancelReply: () => Response = () => new Response(null, { status: 204 })) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000231', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const cancelled: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/my_feature_access')) return Response.json([{ feature_key: 'fnb.table_side', state: 'enabled', tiers: null }]);
    if (url.includes('/rpc/my_fnb_orders')) return Response.json([order]);
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
      <RouterProvider router={router} />
    </RivrDataProvider>,
  );
  return cancelled;
}

describe('Tonight › the order at the seat (F-048)', () => {
  it('offers Cancel while the order is Sent, asks once more, and cancels it', async () => {
    const cancelled = renderTracker(ORDER);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel order' }, LATER));
    expect(cancelled).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel it' }));
    await waitFor(() => expect(cancelled).toEqual([{ p_order_id: 'o1' }]));
  });

  it('says so when the bar accepted it first', async () => {
    renderTracker(ORDER, () => Response.json({ code: '22023', message: 'The bar has accepted that order' }, { status: 400 }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel order' }, LATER));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel it' }));
    expect(await screen.findByText('The bar has started it.', {}, LATER)).toBeDefined();
  });

  it('offers no Cancel once the bar has accepted it', async () => {
    renderTracker({ ...ORDER, accepted_at: '2026-11-15T17:01:00Z' });
    expect(await screen.findByText('Masala chai', {}, LATER)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Cancel order' })).toBeNull();
  });

  it('holds Cancel back with no connection', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    renderTracker(ORDER);
    expect(await screen.findByRole('button', { name: 'Cancel order' }, LATER)).toHaveProperty('disabled', true);
  });

  it('says the member cancelled it, in their words, and offers Order again', async () => {
    renderTracker({ ...ORDER, cancelled_at: '2026-11-15T17:01:00Z', cancel_reason: 'Cancelled by the member' });
    expect(await screen.findByText('You cancelled this order.', {}, LATER)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Order again' })).toBeDefined();
  });

  it('still gives the reason when staff voided it', async () => {
    renderTracker({ ...ORDER, cancelled_at: '2026-11-15T17:01:00Z', cancel_reason: 'Out of chai' });
    expect(await screen.findByText('Cancelled: Out of chai', {}, LATER)).toBeDefined();
  });
});

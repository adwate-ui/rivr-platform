import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { PlayerShell, Text, ToastProvider } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FnbOrderScreen } from './FnbOrderScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const SEAT = {
  table_name: 'Table 3', seat: 5, is_away: false, has_call_time: false, call_time_left: null, played_seconds: 600, is_leaving: false, top_up: null,
  call_time_minutes: null, started_at: '2026-11-15T16:55:00Z', call_time_ends_at: null, table_type_name: 'NLH 100/200', small_blind_paise: 10000,
  big_blind_paise: 20000, time_request_minutes: null, add_time_choices: [30, 60, 120],
};
const MENU = [
  { item_id: 'chai', name: 'Masala chai', kind: 'soft_drink', photo_path: 'v1/menu-chai.jpg' },
  { item_id: 'sandwich', name: 'Club sandwich', kind: 'food', photo_path: null, diet: 'non_veg', description: 'Chicken, egg and bacon' },
  { item_id: 'fries', name: 'French fries', kind: 'food', photo_path: null, diet: null, description: null },
];

/** Signed in with table-side food, seated or not, a menu, a usual, and orders whose first reply is lost. */
function renderOrder(seat: 'seated' | 'not seated', usual: unknown[] = [], at = '/fnb', myOrders: unknown[] = []) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000211', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const orders: unknown[] = [];
  const reads: Record<string, unknown> = {
    '/rpc/my_feature_access': [{ feature_key: 'fnb.table_side', state: 'enabled', tiers: null }], '/rpc/my_seat': seat === 'seated' ? [SEAT] : [],
    '/rpc/my_fnb_menu': MENU, '/rpc/my_usual_fnb_items': usual, '/rpc/my_fnb_orders': myOrders,
  };
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const read = Object.keys(reads).find((path) => url.includes(path));
    if (read !== undefined) return Response.json(reads[read]);
    if (url.includes('/rpc/place_fnb_order')) {
      orders.push(JSON.parse(String(init?.body)));
      // The first reply is lost on a weak signal; the order went through.
      return orders.length === 1 ? Response.json({ message: 'unreachable' }, { status: 503 }) : Response.json([{ order_id: 'o1', kot_number: 7 }]);
    }
    return Response.json([]);
  });
  const rootRoute = createRootRoute({ component: () => <ToastProvider><PlayerShell tabs={[]} isTabBarHidden><Outlet /></PlayerShell></ToastProvider> });
  const tonight = createRoute({ getParentRoute: () => rootRoute, path: '/', component: () => <Text>Tonight screen</Text> });
  const fnb = createRoute({ getParentRoute: () => rootRoute, path: '/fnb', component: FnbOrderScreen });
  const router = createRouter({ routeTree: rootRoute.addChildren([tonight, fnb]), history: createMemoryHistory({ initialEntries: [at] }) });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </RivrDataProvider>,
  );
  return { orders, router };
}

const LATER = { timeout: 5000 };

describe('Tonight › Order', () => {
  it('sends a member who is not seated back to Tonight', async () => {
    const { router } = renderOrder('not seated');
    expect(await screen.findByText('Tonight screen', {}, LATER)).toBeDefined();
    expect(router.state.location.pathname).toBe('/');
  });

  it('shows the seat, the categories, and Add turning into a count with the send bar', async () => {
    renderOrder('seated');
    expect(await screen.findByText('Table 3, seat 5 · Pay on delivery', {}, LATER)).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Order' })).toBeDefined();
    // Drawn under its own Back button, it still names the page and takes the focus (WCAG 2.4.2).
    expect(document.title).toBe('Order · RIVR');
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Order' }));
    expect(screen.getByRole('radio', { name: 'Food' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Add Club sandwich' }));
    expect(screen.getByRole('button', { name: 'One more Club sandwich' })).toBeDefined();
    expect(screen.getByRole('button', { name: /Send to the bar/ }).textContent).toContain('1 item');
    fireEvent.click(screen.getByRole('radio', { name: 'Soft drinks' }));
    expect(screen.getByRole('button', { name: 'Add Masala chai' })).toBeDefined();
  });

  it('marks a dish veg or non-veg and says what it is, where the club has said (F-052)', async () => {
    renderOrder('seated');
    expect(await screen.findByRole('img', { name: 'Non-vegetarian' }, LATER)).toBeDefined();
    expect(screen.getByText('Chicken, egg and bacon')).toBeDefined();
    expect(screen.getAllByRole('img', { name: /egetarian/ })).toHaveLength(1);
  });

  it('asks nothing of the bar until something is added, then sends the note on the last line, the foot of the KOT (F-052)', async () => {
    const { orders } = renderOrder('seated');
    fireEvent.click(await screen.findByRole('button', { name: 'Add Club sandwich' }, LATER));
    expect(screen.getByText('Note for the bar')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Add French fries' }));
    fireEvent.click(screen.getByText('No onion'));
    fireEvent.click(screen.getByText('Less spicy'));
    fireEvent.click(screen.getByRole('button', { name: /Send to the bar/ }));
    await waitFor(() => expect(orders.length).toBeGreaterThan(0));
    expect(orders[0]).toMatchObject({ p_lines: [{ item_id: 'sandwich', quantity: 1, note: null }, { item_id: 'fries', quantity: 1, note: 'no_onion,less_spicy' }] });
  });

  it('Your usual: Add both puts the member\'s two most-ordered items in', async () => {
    renderOrder('seated', [{ item_id: 'chai', times: 3 }, { item_id: 'sandwich', times: 2 }]);
    fireEvent.click(await screen.findByRole('button', { name: /Your usual.*Masala chai, Club sandwich.*Add both/ }, LATER));
    expect(screen.getByRole('button', { name: /Send to the bar/ }).textContent).toContain('2 items');
  });

  it('sends the same request id again after a lost reply, so the bar gets one KOT, then goes to Tonight', async () => {
    const { orders, router } = renderOrder('seated');
    fireEvent.click(await screen.findByRole('button', { name: 'Add French fries' }, LATER));
    fireEvent.click(screen.getByRole('button', { name: /Send to the bar/ }));
    expect(await screen.findByRole('alert')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /Send to the bar/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(await screen.findByText('Order sent')).toBeDefined();
    const [first, second] = orders.map((order) => Reflect.get(Object(order), 'p_idempotency_key'));
    expect(first).toEqual(expect.any(String));
    expect(second).toBe(first);
  });

  it('Order again starts from the last order, leaving out what is no longer on the menu', async () => {
    const order = {
      order_id: 'o1', kot_number: 7, created_at: '2026-11-15T16:10:00Z', accepted_at: '2026-11-15T16:11:00Z', on_way_at: null,
      delivered_at: '2026-11-15T16:20:00Z', cancelled_at: null, cancel_reason: null,
      lines: [{ item_id: 'chai', name: 'Masala chai', kind: 'soft_drink', quantity: 2, note: null }, { item_id: 'gone', name: 'Cold coffee', kind: 'soft_drink', quantity: 1, note: null }],
    };
    renderOrder('seated', [], '/fnb?again=o1', [order]);
    expect((await screen.findByRole('button', { name: /Send to the bar/ }, LATER)).textContent).toContain('2 items');
  });
});

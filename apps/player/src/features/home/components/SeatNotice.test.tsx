import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SeatNotice } from './SeatNotice.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const FEATURES = ['call_time.view', 'table.top_up', 'table.leave', 'fnb.table_side'];

/** Signed in on Tonight, seated at Table 3, seat 5, with 1 h 12 min of call time left and every seat action open. */
function renderSeated() {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000211', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/my_feature_access')) return Response.json(FEATURES.map((key) => ({ feature_key: key, state: 'enabled', tiers: null })));
    if (url.includes('/rpc/my_seat')) {
      return Response.json([{ table_name: 'Table 3', seat: 5, is_away: false, has_call_time: true, call_time_left: 4290, played_seconds: 4800,
        is_leaving: false, top_up: null }]);
    }
    return Response.json([]);
  });
  const rootRoute = createRootRoute();
  const router = createRouter({
    routeTree: rootRoute.addChildren([createRoute({ getParentRoute: () => rootRoute, path: '/', component: SeatNotice })]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </RivrDataProvider>,
  );
}

describe('the seat card (UI polish audit A-08)', () => {
  it('heads the card with the table and seat, and sets the call time left as its figure', async () => {
    renderSeated();
    expect(await screen.findByRole('heading', { level: 2, name: 'Table 3, seat 5' })).toBeDefined();
    expect(screen.getByText('Playing for 1 h 20 min')).toBeDefined();
    expect(await screen.findByText('Call time left')).toBeDefined();
    expect(screen.getByText('1 h 12 min').className).toContain('tabular-nums');
  });

  it('gives the four seat actions short labels, two to a row, each named in full for a screen reader', async () => {
    renderSeated();
    const extend = await screen.findByRole('button', { name: 'Add an hour of call time' });
    expect(extend.textContent).toBe('Add an hour');
    const grid = extend.closest('.grid');
    if (!(grid instanceof HTMLElement)) throw new Error('The seat actions are not in a grid');
    const actions = within(grid);
    expect(actions.getByRole('button', { name: 'Top up' })).toBeDefined();
    expect(actions.getByRole('button', { name: 'Order food and drink' }).textContent).toBe('Order');
    expect(actions.getByRole('button', { name: 'Leave my seat' })).toBeDefined();
    expect(grid.className).toContain('grid-cols-2');
  });
});

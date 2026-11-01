import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { Heading } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { cleanup, render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventsScreen } from './EventsScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** Signed in at `path`, with `feature` hidden for the member's tier, and Tonight at `/`. */
function renderHidden(path: string, feature: string, screen: () => JSX.Element) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000211', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/my_feature_access')) return Response.json([{ feature_key: feature, state: 'hidden', tiers: [] }]);
    return Response.json([]);
  });
  const rootRoute = createRootRoute();
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      createRoute({ getParentRoute: () => rootRoute, path: '/', component: () => <Heading level={1}>Tonight</Heading> }),
      createRoute({ getParentRoute: () => rootRoute, path, component: screen }),
    ]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </RivrDataProvider>,
  );
}

describe('Events, hidden for every tier (decision 0284)', () => {
  it('goes to Tonight rather than a heading over nothing', async () => {
    renderHidden('/events', 'events.book', EventsScreen);
    expect(await screen.findByRole('heading', { level: 1, name: 'Tonight' })).toBeDefined();
    expect(screen.queryByRole('heading', { level: 1, name: 'Events' })).toBeNull();
  });
});

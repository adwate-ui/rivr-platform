import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { BUILT_IN_SOURCES } from '@rivr/drills/sources';
import { Heading } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { JSX } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BookScreen } from './BookScreen.tsx';
import { LearnScreen } from './LearnScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const BOOK = BUILT_IN_SOURCES[0];
if (BOOK === undefined) throw new Error('RIVR ships with at least one book');

/** Learn, and a book that ships with RIVR, each with the heading it shows. */
const SCREENS = [
  { name: 'Learn', path: '/learn', heading: 'Learn' },
  { name: 'a book', path: `/learn/${BOOK.id}`, heading: BOOK.title },
];

/** Signed in at `path`, with the feature map on its way for good, or failing once and then giving Learn. */
function renderAt(path: string, map: 'on its way' | 'fails once') {
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
    return Response.json(['learn.library', 'learn.academy_lessons', 'learn.drills'].map((key) => ({ feature_key: key, state: 'enabled', tiers: null })));
  });
  const rootRoute = createRootRoute();
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      createRoute({ getParentRoute: () => rootRoute, path: '/learn', component: LearnScreen }),
      createRoute({ getParentRoute: () => rootRoute, path: '/learn/$sourceKey', component: BookScreen }),
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

describe('Learn and a book, while the feature map loads or fails (a weak signal in the club)', () => {
  it.each(SCREENS)('$name says it is loading while the map is on its way', async ({ path, heading }) => {
    renderAt(path, 'on its way');
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeDefined();
    await waitFor(() => expect(screen.getByText('Loading')).toBeDefined());
    // Still loading once everything else it reads has answered.
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(screen.getByText('Loading')).toBeDefined();
  });

  it.each(SCREENS)('$name says it could not load when the map fails, and loads on Try again', async ({ path, heading }) => {
    renderAt(path, 'fails once');
    expect(await screen.findByText('Could not load this. Check the connection and try again.')).toBeDefined();
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.queryByText('Could not load this. Check the connection and try again.')).toBeNull());
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });
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

describe('Learn, hidden for every tier (decision 0284)', () => {
  it('goes to Tonight rather than showing an empty screen', async () => {
    renderHidden('/learn', 'learn.library', LearnScreen);
    expect(await screen.findByRole('heading', { level: 1, name: 'Tonight' })).toBeDefined();
    expect(screen.queryByRole('heading', { level: 1, name: 'Learn' })).toBeNull();
  });

  it('sends the address of a book to Tonight too', async () => {
    renderHidden(`/learn/${BOOK.id}`, 'learn.library', BookScreen);
    expect(await screen.findByRole('heading', { level: 1, name: 'Tonight' })).toBeDefined();
    expect(screen.queryByRole('heading', { level: 1, name: BOOK.title })).toBeNull();
  });
});

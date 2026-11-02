import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { Text } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HouseRulesScreen } from './HouseRulesScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const RULES = { page_slug: 'house-rules', kind: 'rules', content: { rules: ['One player to a hand.', 'English only at the table.'] } };

/** A member opening House rules from Profile, with the club's rules and no line of its own under the title. */
function renderRules(blocks: unknown[]) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000242', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    return Response.json(url.includes('/rest/v1/public_site_block') ? blocks : []);
  });
  const rootRoute = createRootRoute();
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      createRoute({ getParentRoute: () => rootRoute, path: '/profile', component: () => <Text>Profile screen</Text> }),
      createRoute({ getParentRoute: () => rootRoute, path: '/profile/rules', component: HouseRulesScreen }),
    ]),
    history: createMemoryHistory({ initialEntries: ['/profile/rules'] }),
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </RivrDataProvider>,
  );
  return router;
}

describe('House rules', () => {
  it('numbers each rule, under the title and its line', async () => {
    renderRules([RULES]);
    expect(await screen.findByText('English only at the table.', {}, { timeout: 5000 })).toBeDefined();
    expect(screen.getByRole('heading', { level: 1, name: 'House rules' })).toBeDefined();
    expect(screen.getByText('The floor applies these at every table.')).toBeDefined();
    expect(screen.getByText('1')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
  });

  it('says there are none yet when the club has published none', async () => {
    renderRules([]);
    expect(await screen.findByRole('heading', { level: 1, name: 'House rules' }, { timeout: 5000 })).toBeDefined();
    expect(screen.queryByText('1')).toBeNull();
  });

  it('goes back to Profile', async () => {
    const router = renderRules([RULES]);
    fireEvent.click(await screen.findByRole('button', { name: 'Profile' }, { timeout: 5000 }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/profile'));
  });
});

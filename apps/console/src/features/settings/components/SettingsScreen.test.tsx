import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, StaffVenueProvider } from '@rivr/db';
import { Text } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { partOf, SettingsScreen } from './SettingsScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** A staff member in `role` on Settings with `?tab=` as given; the parts from other features stand in as words. */
function renderAs(role: string, tab: string | undefined) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rest/v1/staff')) {
      return Response.json([{ id: 'st1', venue_id: 'v1', full_name: 'Vikram Rao', role, venue: { name: 'RIVR Gurugram', is_practice: false } }]);
    }
    return Response.json([]);
  });
  const screenAt = () => <SettingsScreen tab={tab} devices={<Text>The devices part</Text>} gamesHistory={<Text>The games history part</Text>} />;
  const router = createRouter({ routeTree: createRootRoute({ component: screenAt }), history: createMemoryHistory({ initialEntries: ['/settings'] }) });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StaffVenueProvider><RouterProvider router={router} /></StaffVenueProvider>
    </RivrDataProvider>,
  );
}

describe('Settings, Devices and Games history as tabs of Settings (console v3)', () => {
  it('reads the part from the address: a kind of device is Devices, history its own, anything else an area', () => {
    expect(['tvs', 'tablets', 'devices', 'history', 'games-history', 'club', 'floor', undefined].map(partOf))
      .toEqual(['devices', 'devices', 'devices', 'history', 'history', 'settings', 'settings', 'settings']);
  });

  it('gives a super admin all three parts as tabs, the one asked for open', async () => {
    renderAs('super_admin', 'tablets');
    const parts = await screen.findByRole('navigation', { name: 'Settings, devices and games history' }, { timeout: 5000 });
    expect(Array.from(parts.querySelectorAll('a'), (link) => [link.textContent, link.getAttribute('href'), link.getAttribute('aria-current')])).toEqual([
      ['Settings', '/settings', null], ['Devices', '/settings?tab=tvs', 'page'], ['Games history', '/settings?tab=history', null],
    ]);
    expect(screen.getByText('The devices part')).toBeDefined();
  });

  it('opens the rules for an area in the address, under their own heading', async () => {
    renderAs('super_admin', 'club');
    expect(await screen.findByRole('heading', { name: 'Settings', level: 1 }, { timeout: 5000 })).toBeDefined();
    expect(screen.getByRole('navigation', { name: 'Areas' }).querySelector('[aria-current="page"]')?.textContent).toBe('Club details');
  });

  it('refuses a cashier, who has none of the parts', async () => {
    renderAs('cashier', undefined);
    expect(await screen.findByText('Not in your role. Ask an admin.', {}, { timeout: 5000 })).toBeDefined();
  });
});

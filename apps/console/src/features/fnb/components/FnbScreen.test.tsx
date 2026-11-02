import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, StaffVenueProvider } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FnbScreen } from './FnbScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** A staff member in `role` on Food and drink, with tonight's lists empty. */
function renderAs(role: string) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000108', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rest/v1/staff')) {
      return Response.json([{ id: 'st1', venue_id: 'v1', full_name: 'Farida Floor', role, venue: { name: 'RIVR Gurugram', is_practice: false } }]);
    }
    return Response.json([]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StaffVenueProvider><FnbScreen /></StaffVenueProvider>
    </RivrDataProvider>,
  );
}

describe('Food and drink (decision 0302)', () => {
  it('lets the floor, who serve and read who sits where, order for a seat', async () => {
    renderAs('floor');
    expect(await screen.findByRole('heading', { name: 'Order for a seat' }, { timeout: 5000 })).toBeDefined();
  });

  it('gives Service, who read no members, serving alone', async () => {
    renderAs('service');
    expect(await screen.findByRole('heading', { name: 'To accept' }, { timeout: 5000 })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Order for a seat' })).toBeNull();
  });
});

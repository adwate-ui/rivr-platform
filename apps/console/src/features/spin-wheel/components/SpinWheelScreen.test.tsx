import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, StaffVenueProvider } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SpinWheelScreen } from './SpinWheelScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** A staff member in `role` on the spin wheel, with no spins waiting. */
function renderAs(role: string) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000107', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rest/v1/staff')) {
      return Response.json([{ id: 'st1', venue_id: 'v1', full_name: 'Ishita Bose', role, venue: { name: 'RIVR Gurugram', is_practice: false } }]);
    }
    return Response.json([]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StaffVenueProvider><SpinWheelScreen /></StaffVenueProvider>
    </RivrDataProvider>,
  );
}

describe('Spin wheel (decision 0302)', () => {
  it('lets staff who run promotions spin and keep the wheel, as the database asks', async () => {
    renderAs('marketing');
    expect(await screen.findByRole('heading', { name: 'Spin wheel', level: 1 }, { timeout: 5000 })).toBeDefined();
    expect(await screen.findByRole('heading', { name: 'Spins waiting' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'The wheel' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Add to the wheel' })).toBeDefined();
  });

  it('refuses the floor, who run no promotions', async () => {
    renderAs('floor');
    expect(await screen.findByText('Not in your role. Ask an admin.', {}, { timeout: 5000 })).toBeDefined();
  });
});

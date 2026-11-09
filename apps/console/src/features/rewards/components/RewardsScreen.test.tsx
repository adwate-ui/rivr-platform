import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, StaffVenueProvider } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RewardsPointsScreen, RewardsScreen } from './RewardsScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const HOODIE = { id: 'r1', kind: 'merchandise', name: 'RIVR hoodie', detail: 'At the host desk', points: 4000, nights: null, stock: 42, is_live: true, photo_path: null };
/** A staff member in `role` on one of Rewards' tabs, with one reward in the catalogue. */
function renderAs(role: string, Tab: ComponentType) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000107', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rest/v1/staff')) {
      return Response.json([{ id: 'st1', venue_id: 'v1', full_name: 'Ishita Bose', role, venue: { name: 'RIVR Gurugram', is_practice: false } }]);
    }
    if (url.includes('/rest/v1/reward_item')) return Response.json([HOODIE]);
    return Response.json([]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StaffVenueProvider><Tab /></StaffVenueProvider>
    </RivrDataProvider>,
  );
}

const LAZY = { timeout: 5000 };

describe('Rewards', () => {
  it('shows the catalogue', async () => {
    renderAs('floor', RewardsScreen);
    expect(await screen.findByText('RIVR hoodie', {}, LAZY)).toBeDefined();
  });

  it('opens the form for a new reward from the one gold button, and for a reward from its Edit', async () => {
    renderAs('floor', RewardsScreen);
    fireEvent.click(await screen.findByRole('button', { name: 'New reward' }, LAZY));
    expect(screen.getByRole('heading', { name: 'New reward' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'New reward' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit RIVR hoodie' }));
    expect(screen.getByRole('heading', { name: 'Edit RIVR hoodie' })).toBeDefined();
  });

  it('keeps points by hand and League points from a file together on their tab', async () => {
    renderAs('floor', RewardsPointsScreen);
    expect(await screen.findByRole('heading', { name: 'League points from a CSV' }, LAZY)).toBeDefined();
    expect(screen.getAllByRole('heading', { name: 'Points by hand' }).length).toBeGreaterThan(0);
  });
});

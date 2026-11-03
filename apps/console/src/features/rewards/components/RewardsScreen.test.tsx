import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, StaffVenueProvider } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RewardsParts } from './RewardsScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const HOODIE = { id: 'r1', kind: 'merchandise', name: 'RIVR hoodie', detail: 'At the host desk', points: 4000, nights: null, stock: 42, is_live: true, photo_path: null };
const WAITING = {
  id: 'd1', member_id: 'm1', full_name: 'Sakshi Tandon', member_number: 66, reward_name: 'RIVR hoodie', kind: 'merchandise', points: 4000, nights: null,
  created_at: '2026-11-15T15:00:00Z', handed_over_at: null, handed_over_by: null,
};

/** A staff member in `role` on Rewards at `part`, with one reward in the catalogue and one waiting to be handed over. */
function renderAs(role: string, part: string | undefined) {
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
    if (url.includes('/rpc/venue_redemptions')) return Response.json([WAITING]);
    return Response.json([]);
  });
  const onNavigate = vi.fn();
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StaffVenueProvider><RewardsParts part={part} onNavigate={onNavigate} /></StaffVenueProvider>
    </RivrDataProvider>,
  );
  return onNavigate;
}

const LAZY = { timeout: 5000 };

describe('Rewards', () => {
  it('gives the floor the catalogue, hand over and points by hand, each counting what waits', async () => {
    renderAs('floor', undefined);
    expect(await screen.findByRole('link', { name: 'Catalogue 1' }, LAZY)).toBeDefined();
    expect(await screen.findByRole('link', { name: 'Hand over 1' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Points by hand' })).toBeDefined();
    expect(await screen.findByText('RIVR hoodie')).toBeDefined();
  });

  it('opens the form for a new reward from the one gold button, and for a reward from its Edit', async () => {
    renderAs('floor', 'catalogue');
    fireEvent.click(await screen.findByRole('button', { name: 'New reward' }, LAZY));
    expect(screen.getByRole('heading', { name: 'New reward' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'New reward' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit RIVR hoodie' }));
    expect(screen.getByRole('heading', { name: 'Edit RIVR hoodie' })).toBeDefined();
  });

  it('lists what waits to be handed over on its tab', async () => {
    renderAs('floor', 'handover');
    expect(await screen.findByRole('button', { name: 'Hand RIVR hoodie over to Sakshi Tandon' }, LAZY)).toBeDefined();
  });

  it('keeps points by hand and League points from a file together on their tab', async () => {
    renderAs('floor', 'points');
    expect(await screen.findByRole('heading', { name: 'Give points by hand' }, LAZY)).toBeDefined();
    expect(screen.getByRole('heading', { name: 'League points from a CSV' })).toBeDefined();
  });

  it('shows marketing, who keep the catalogue alone, the catalogue whatever part the address asks for', async () => {
    renderAs('marketing', 'points');
    expect(await screen.findByText('RIVR hoodie', {}, LAZY)).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Points by hand' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Give points by hand' })).toBeNull();
  });

  it('asks the address to change when a part is chosen', async () => {
    const onNavigate = renderAs('floor', undefined);
    fireEvent.click(await screen.findByRole('link', { name: 'Points by hand' }, LAZY));
    expect(onNavigate).toHaveBeenCalledWith('/rewards?tab=rewards&part=points');
  });

  it('refuses a role with no rewards', async () => {
    renderAs('dealer', undefined);
    expect(await screen.findByText('Not in your role. Ask an admin.', {}, LAZY)).toBeDefined();
  });
});

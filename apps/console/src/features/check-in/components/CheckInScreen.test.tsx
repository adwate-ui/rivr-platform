import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, StaffVenueProvider } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CheckInScreen } from './CheckInScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const BOARD = [
  { member_id: 'm1', full_name: 'Kabir Sethi', tier_name: 'Black card', is_in_room: false, since: '2026-11-03T14:00:00Z' },
  { member_id: 'm2', full_name: 'Nakul Dhillon', tier_name: 'Member', is_in_room: true, since: '2026-11-03T14:05:00Z' },
];

/** A staff member in `role` on Check-in; the door board holds one expected member and one in the room. */
function renderAs(role: string) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000104', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rest/v1/staff')) {
      return Response.json([{ id: 'st1', venue_id: 'v1', full_name: 'Sunita Pillai', role, venue: { name: 'RIVR Gurugram', is_practice: false } }]);
    }
    return Response.json(url.includes('/rpc/door_board') ? BOARD : []);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StaffVenueProvider><CheckInScreen /></StaffVenueProvider>
    </RivrDataProvider>,
  );
}

describe('Check-in', () => {
  it('shows the one field, then Expected tonight and In the room, each a region with its count', async () => {
    renderAs('host');
    expect(await screen.findByRole('textbox', { name: 'Card, mobile, number or name' }, { timeout: 5000 })).toBeDefined();
    expect(screen.getByRole('heading', { level: 1, name: 'Check-in' })).toBeDefined();
    const expected = screen.getByRole('region', { name: 'Expected tonight' });
    expect(within(expected).getByText('Kabir Sethi')).toBeDefined();
    expect(within(expected).getByText('1')).toBeDefined();
    expect(within(expected).getByRole('button', { name: 'Check in Kabir Sethi' })).toBeDefined();
    expect(within(screen.getByRole('region', { name: 'In the room' })).getByRole('button', { name: 'Check out Nakul Dhillon' })).toBeDefined();
  });

  it('refuses a dealer, who keeps no door', async () => {
    renderAs('dealer');
    expect(await screen.findByText('Not in your role. Ask the front desk.', {}, { timeout: 5000 })).toBeDefined();
  });
});

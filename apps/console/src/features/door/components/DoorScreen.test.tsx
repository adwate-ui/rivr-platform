import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, StaffVenueProvider } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DoorScreen } from './DoorScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const BOARD = [
  { member_id: 'm1', full_name: 'Kabir Sethi', tier_name: 'Black card', is_in_room: false, since: '2026-11-03T14:00:00Z' },
  { member_id: 'm2', full_name: 'Nakul Dhillon', tier_name: 'Member', is_in_room: true, since: '2026-11-03T14:05:00Z' },
];

/** A staff member in `role` at the Door, on `tab`; the door board holds one expected member and one in the room. */
function renderDoor(role: string, tab: string | undefined) {
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
  const onNavigate = vi.fn();
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StaffVenueProvider><DoorScreen tab={tab} onNavigate={onNavigate} /></StaffVenueProvider>
    </RivrDataProvider>,
  );
  return onNavigate;
}

describe('the Door', () => {
  it('opens on Check-in: the one field, then Expected tonight and In the room, each a region with its count', async () => {
    renderDoor('host', undefined);
    expect(await screen.findByRole('textbox', { name: 'Card, mobile, number or name' }, { timeout: 5000 })).toBeDefined();
    expect(screen.getByRole('heading', { level: 1, name: 'Check-in' })).toBeDefined();
    const expected = screen.getByRole('region', { name: 'Expected tonight' });
    expect(within(expected).getByText('Kabir Sethi')).toBeDefined();
    expect(within(expected).getByRole('button', { name: 'Check in Kabir Sethi' })).toBeDefined();
    expect(within(screen.getByRole('region', { name: 'In the room' })).getByRole('button', { name: 'Check out Nakul Dhillon' })).toBeDefined();
  });

  it("shows Today's players on its tab, and moves between the tabs by their addresses", async () => {
    const onNavigate = renderDoor('host', 'today');
    expect(await screen.findByRole('heading', { level: 1, name: 'Today’s players' }, { timeout: 5000 })).toBeDefined();
    const tabs = screen.getByRole('navigation', { name: 'Door' });
    fireEvent.click(within(tabs).getByRole('link', { name: 'Check-in' }));
    expect(onNavigate).toHaveBeenCalledWith('/door?tab=checkin');
  });

  it('opens Check-in for a tab it does not have', async () => {
    renderDoor('host', 'nope');
    expect(await screen.findByRole('heading', { level: 1, name: 'Check-in' }, { timeout: 5000 })).toBeDefined();
  });

  it('refuses a dealer, who keeps no door', async () => {
    renderDoor('dealer', 'checkin');
    expect(await screen.findByText('Not in your role. Ask the front desk.', {}, { timeout: 5000 })).toBeDefined();
  });
});

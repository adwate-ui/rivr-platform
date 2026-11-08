import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, StaffVenueProvider } from '@rivr/db';
import { formatDuration } from '@rivr/i18n';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TodaysPlayersScreen } from './TodaysPlayersScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** A player today as the database lists them. */
const player = (name: string, status: string, tables: { table: string; seconds: number }[] = []) => ({
  member_id: name, full_name: name, member_number: 7, status, checked_in_at: '2026-11-03T14:05:00Z', checked_out_at: null,
  waiting_seconds: 540, tables,
});

const TODAY = [
  player('Bhuvan Walia', 'playing', [{ table: 'Table 1', seconds: 1800 }, { table: 'Table 2', seconds: 3600 }]),
  player('Mrinal Thakur', 'playing', [{ table: 'Table 2', seconds: 600 }]),
  player('Arjun Mehta', 'waiting'),
  player('Tara Singh', 'left'),
];

/** A floor manager on Today's players, with `rows` at the club today. */
function renderTab(rows: unknown[]) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000108', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rest/v1/staff')) {
      return Response.json([{ id: 'st1', venue_id: 'v1', full_name: 'Farida Floor', role: 'floor', venue: { name: 'RIVR Gurugram', is_practice: false } }]);
    }
    return Response.json(url.includes('/rpc/todays_players') ? rows : []);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StaffVenueProvider><TodaysPlayersScreen /></StaffVenueProvider>
    </RivrDataProvider>,
  );
}

describe("Today's players", () => {
  it('counts the players by status on its filter chips', async () => {
    renderTab(TODAY);
    const chips = await screen.findByRole('radiogroup', { name: 'Status' }, { timeout: 5000 });
    for (const name of ['All, 4', 'Playing, 2', 'Waiting, 1', 'Left, 1']) expect(within(chips).getByRole('radio', { name })).toBeDefined();
    expect(within(chips).getByRole('radio', { name: 'All, 4' }).getAttribute('aria-checked')).toBe('true');
  });

  it('tells who is in the room and who never arrived from who left (audit F-097)', async () => {
    renderTab([...TODAY, player('Kabir Sethi', 'in_room'), player('Yash Gupta', 'never_arrived')]);
    const chips = await screen.findByRole('radiogroup', { name: 'Status' }, { timeout: 5000 });
    for (const name of ['In the room, 1', 'Left, 1', 'Never arrived, 1']) expect(within(chips).getByRole('radio', { name })).toBeDefined();
  });

  it('shows only the players of the status chosen', async () => {
    renderTab(TODAY);
    fireEvent.click(await screen.findByRole('radio', { name: 'Waiting, 1' }, { timeout: 5000 }));
    expect(screen.getByRole('row', { name: /Arjun Mehta/ })).toBeDefined();
    expect(screen.queryByRole('row', { name: /Bhuvan Walia/ })).toBeNull();
  });

  it('gives the tables and the time played their own columns', async () => {
    renderTab(TODAY);
    const row = await screen.findByRole('row', { name: /Bhuvan Walia/ }, { timeout: 5000 });
    expect(screen.getByRole('columnheader', { name: /^Table/ })).toBeDefined();
    expect(screen.getByRole('columnheader', { name: /^Time played/ })).toBeDefined();
    expect(within(row).getByText('Table 1, Table 2')).toBeDefined();
    expect(within(row).getByText(formatDuration(5400))).toBeDefined();
  });

  it('says so when nobody has come in today', async () => {
    renderTab([]);
    expect(await screen.findByText('Nobody has come in today yet.', {}, { timeout: 5000 })).toBeDefined();
  });
});

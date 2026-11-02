import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StandingsTable } from './StandingsTable.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const MIHIR = {
  place: 1, member_id: '00000000-0000-4000-8000-000000000213', full_name: 'Mihir Shah', member_number: 1042,
  cash_points: 120, tournament_points: 30, hand_points: 40, points: 190,
};

describe('StandingsTable', () => {
  it('shows the League points given by hand apart, beside cash and tournaments, and in the total (L-01)', async () => {
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
      }),
    );
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = String(input instanceof Request ? input.url : input);
      return Response.json(url.includes('/rpc/venue_league') ? [MIHIR] : []);
    });
    render(
      <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}>
        <StandingsTable venueId="v1" label="November" firstMonth="2026-11-01" lastMonth="2026-11-01" />
      </RivrDataProvider>,
    );
    const row = await screen.findByRole('row', { name: /Mihir Shah/ }, { timeout: 5000 });
    expect(screen.getByRole('columnheader', { name: /By hand/ })).toBeDefined();
    expect(within(row).getAllByRole('cell').map((cell) => cell.textContent).slice(-4)).toEqual(['120', '30', '40', '190']);
  });
});

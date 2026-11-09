import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { clubDay, dayAfter } from '@rivr/domain/clubDay';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TablesReport } from './TablesReport.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const TABLE_2 = { table_id: 't2', table_name: 'Table 2', seats: 9, run_seconds: 14_400, players: 2, peak: 2, player_seconds: 16_200 };

/** The view, signed in, with table_metrics answering TABLE_2; what each call asked for is kept. */
function renderReport() {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const asked: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!String(input instanceof Request ? input.url : input).includes('/rpc/table_metrics')) return Response.json([]);
    asked.push(JSON.parse(String(init?.body)));
    return Response.json([TABLE_2]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TablesReport venueId="v1" exportIn={null} />
    </RivrDataProvider>,
  );
  return { asked };
}

describe('the MIS Tables view (owner, 8 Nov)', () => {
  it('shows each table over the last 7 club days: hours run, players, the most at once, player hours and use', async () => {
    const { asked } = renderReport();
    const table = await screen.findByRole('table', { name: 'Tables' });
    const row = (await within(table).findByText('Table 2')).closest('[role="row"]');
    for (const shown of ['9', '4 h', '2', '4 h 30 min', '12%']) expect(row?.textContent).toContain(shown);
    const today = clubDay(new Date());
    expect(asked[0]).toEqual({ p_venue_id: 'v1', p_from: dayAfter(today, -6), p_to: today });
  });

  it('asks again for tonight or the last 30 club days', async () => {
    const { asked } = renderReport();
    await screen.findByRole('table', { name: 'Tables' });
    fireEvent.click(screen.getByRole('radio', { name: 'Last 30 days' }));
    const today = clubDay(new Date());
    await waitFor(() => expect(asked).toContainEqual({ p_venue_id: 'v1', p_from: dayAfter(today, -29), p_to: today }));
    fireEvent.click(screen.getByRole('radio', { name: 'Tonight' }));
    await waitFor(() => expect(asked).toContainEqual({ p_venue_id: 'v1', p_from: today, p_to: today }));
  });
});

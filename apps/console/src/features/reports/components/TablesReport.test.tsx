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

const TABLE_2 = { table_id: 't2', table_name: 'Table 2', seats: 9, run_seconds: 14_400, players: 2, peak: 2, player_seconds: 16_200, previous_player_seconds: 14_400 };
const NEW_TABLE = { table_id: 't7', table_name: 'Private Room', seats: 6, run_seconds: 0, players: 0, peak: 0, player_seconds: 0, previous_player_seconds: 0 };
const ROOM = { seats: 15, run_seconds: 14_400, seat_seconds: 129_600, players: 3, peak: 4, player_seconds: 16_200, previous_player_seconds: 18_000 };

/** The view, signed in, with table_metrics answering TABLE_2; what each call asked for is kept. */
function renderReport(tables: readonly object[] = [TABLE_2, NEW_TABLE]) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const asked: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/table_metrics_total')) return Response.json([ROOM]);
    if (!url.includes('/rpc/table_metrics')) return Response.json([]);
    asked.push(JSON.parse(String(init?.body)));
    return Response.json(tables);
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
    for (const shown of ['9', '4 h', '2', '4 h 30 min', '12%', '+13%']) expect(row?.textContent).toContain(shown);
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
    fireEvent.click(screen.getByRole('radio', { name: 'Last 90 days' }));
    await waitFor(() => expect(asked).toContainEqual({ p_venue_id: 'v1', p_from: dayAfter(today, -89), p_to: today }));
  });

  it('says so when the venue has no tables', async () => {
    renderReport([]);
    expect(await screen.findByText('No tables set up yet.')).toBeDefined();
  });

  it('filters the change by its figure, and a table with nothing to compare is no figure (decision 0512)', async () => {
    renderReport();
    const table = await screen.findByRole('table', { name: 'Tables' });
    await within(table).findByText('Private Room');
    fireEvent.click(screen.getByRole('button', { name: 'Change: sort and filter' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'To' }), { target: { value: '50' } });
    await waitFor(() => expect(within(table).queryByText('Private Room')).toBeNull());
    expect(within(table).getByText('Table 2')).toBeDefined();
  });

  it('lists a table that did not run, with no change to show (F-107)', async () => {
    renderReport();
    const table = await screen.findByRole('table', { name: 'Tables' });
    const row = (await within(table).findByText('Private Room')).closest('[role="row"]');
    expect(row?.textContent).toContain('–');
  });

  it('adds the room up under the tables, its own players, peak and how full (F-107)', async () => {
    renderReport();
    const table = await screen.findByRole('table', { name: 'Tables' });
    const row = (await within(table).findByText('All tables')).closest('[role="row"]');
    expect(row).toBe(within(table).getAllByRole('row').at(-1));
    for (const shown of ['15', '4 h', '3', '4', '4 h 30 min', '12%', '−10%']) expect(row?.textContent).toContain(shown);
    expect(await screen.findByText('Change is player hours against the 7 days before.')).toBeDefined();
  });

  it('asks for dates of one\'s own once they make a span, and says when they do not', async () => {
    const { asked } = renderReport();
    await screen.findByRole('table', { name: 'Tables' });
    fireEvent.click(screen.getByRole('radio', { name: 'Choose dates' }));
    const today = clubDay(new Date());
    await waitFor(() => expect(asked).toContainEqual({ p_venue_id: 'v1', p_from: dayAfter(today, -29), p_to: today }));
    const from = dayAfter(today, -2);
    fireEvent.change(screen.getByLabelText('From'), { target: { value: from } });
    await waitFor(() => expect(asked).toContainEqual({ p_venue_id: 'v1', p_from: from, p_to: today }));
    expect(await screen.findByText('Change is player hours against the 3 days before.')).toBeDefined();
    const count = asked.length;
    fireEvent.change(screen.getByLabelText('From'), { target: { value: dayAfter(today, 1) } });
    expect(await screen.findByText('Choose a From on or before To, up to 92 days, and none ahead of tonight.')).toBeDefined();
    expect(asked).toHaveLength(count);
  });
});

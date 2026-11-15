import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, StaffVenueProvider } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TopUpsScreen } from './TopUpsScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const ago = (seconds: number) => new Date(Date.now() - seconds * 1000).toISOString();
const NO_STEPS = { accepted_by: null, accepted_seconds: null, done_by: null, done_seconds: null };
/** What top_up_history was asked, by the test that reads a past day. */
let asked: unknown[] = [];
const REQUESTS = [
  { request_id: 'r1', session_id: 's1', table_name: 'Table 3', seat: 5, full_name: 'Kabir Sethi', status: 'requested', requested_at: ago(95), fulfilled_seconds: null, ...NO_STEPS },
  { request_id: 'r2', session_id: 's2', table_name: 'Table 2', seat: 1, full_name: 'Naina Kapoor', status: 'in_progress', requested_at: ago(20), fulfilled_seconds: null, ...NO_STEPS, accepted_by: 'Pooja Nair', accepted_seconds: 12 },
  { request_id: 'r3', session_id: 's3', table_name: 'Table 2', seat: 4, full_name: 'Rohan Bhatia', status: 'fulfilled', requested_at: ago(900), fulfilled_seconds: 48, accepted_by: 'Pooja Nair', accepted_seconds: 20, done_by: 'Sana Qureshi', done_seconds: 28 },
];
// Past days come a page at a time: 51 that day, so two pages.
const PAST = [
  { request_id: 'p1', table_name: 'Table 1', seat: 2, full_name: 'Ishaan Verma', status: 'fulfilled', requested_at: '2026-11-14T15:30:00Z', accepted_by: 'Pooja Nair', accepted_seconds: 75, done_by: 'Pooja Nair', done_seconds: 140, total: 51 },
  { request_id: 'p2', table_name: 'Table 4', seat: 7, full_name: 'Vihaan Kapoor', status: 'reset', requested_at: '2026-11-14T14:10:00Z', accepted_by: null, accepted_seconds: null, done_by: null, done_seconds: null, total: 51 },
];

/** Sana, a cashier (waitlist.manage), on Top-ups with tonight's three requests; every top-up set is kept. */
function renderTopUps() {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000104', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const set: unknown[] = [];
  asked = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rest/v1/staff')) {
      return Response.json([{ id: 'st1', venue_id: 'v1', full_name: 'Sana Qureshi', role: 'cashier', venue: { name: 'RIVR Gurugram', is_practice: false } }]);
    }
    if (url.includes('/rpc/top_ups_tonight')) return Response.json(REQUESTS);
    if (url.includes('/rpc/top_up_history')) {
      asked.push(JSON.parse(String(init?.body)));
      return Response.json(PAST);
    }
    if (url.includes('/rpc/set_top_up')) {
      set.push(JSON.parse(String(init?.body)));
      return new Response(null, { status: 204 });
    }
    return Response.json([]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StaffVenueProvider><TopUpsScreen /></StaffVenueProvider>
    </RivrDataProvider>,
  );
  return set;
}

describe('Top-ups (decision 0299)', () => {
  it('lists the waiting ones oldest first, the late one in red, and tonight’s closed ones below', async () => {
    renderTopUps();
    // The first read waits as long as other screens' do: CI's machines are slow under load.
    expect(await screen.findByText('Table 3, seat 5 · Kabir Sethi', {}, { timeout: 5000 })).toBeDefined();
    expect(screen.getByText(/^Late \d\d:\d\d$/).className).toContain('bg-alert');
    expect(screen.getByText(/^00:[2-5]\d$/)).toBeDefined();
    expect(screen.getByText('Fulfilled in 1 min')).toBeDefined();
  });

  it('says who accepted a request and who marked it done, and how long each step took (redesign RD-32)', async () => {
    renderTopUps();
    expect(await screen.findByText('Table 2, seat 1 · Naina Kapoor', {}, { timeout: 5000 })).toBeDefined();
    expect(screen.getByText('Accepted by Pooja Nair in 0:12')).toBeDefined();
    expect(screen.getByText('Accepted by Pooja Nair in 0:20')).toBeDefined();
    expect(screen.getByText('Done by Sana Qureshi in 0:28')).toBeDefined();
  });

  it('lists a past day a page at a time from the server, with who took each step and how long it took', async () => {
    renderTopUps();
    const table = await screen.findByRole('table', { name: 'Top-ups of the day' }, { timeout: 5000 });
    const row = (await within(table).findByText('Ishaan Verma')).closest('[role="row"]');
    expect(row?.textContent).toContain('Table 1, seat 2');
    expect(row?.textContent).toContain('Pooja Nair');
    expect(row?.textContent).toContain('1:15');
    expect(row?.textContent).toContain('2:20');
    expect(within(table).getByText('Vihaan Kapoor').closest('[role="row"]')?.textContent).toContain('Reset');
    expect(asked[0]).toMatchObject({ p_venue_id: 'v1', p_page: 1, p_page_size: 50 });
    // Another day asks the server again, from the first page.
    fireEvent.change(screen.getByLabelText('Day'), { target: { value: '2026-11-13' } });
    await waitFor(() => expect(asked.at(-1)).toMatchObject({ p_day: '2026-11-13', p_page: 1 }));
    // The second page is asked of the server, not cut from rows in hand.
    fireEvent.click(await screen.findByRole('button', { name: 'Page 2' }));
    await waitFor(() => expect(asked.at(-1)).toMatchObject({ p_day: '2026-11-13', p_page: 2 }));
  });

  it('starts a top-up that was asked for, and finishes one in hand', async () => {
    const set = renderTopUps();
    fireEvent.click(await screen.findByRole('button', { name: 'The top-up for Kabir Sethi is in progress' }, { timeout: 5000 }));
    fireEvent.click(screen.getByRole('button', { name: 'The top-up for Naina Kapoor is done' }));
    await waitFor(() => expect(set).toEqual([{ p_session_id: 's1', p_in_progress: true }, { p_session_id: 's2', p_in_progress: false }]));
  });
});

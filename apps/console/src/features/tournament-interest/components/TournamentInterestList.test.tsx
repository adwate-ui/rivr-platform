import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, StaffVenueProvider } from '@rivr/db';
import { ToastProvider } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TournamentInterestScreen } from './TournamentInterestList.tsx';

const VENUE = '00000000-0000-4000-8000-000000000001';

/** Two members asked about the same tournament; one is registered. */
const INTEREST = [
  { interest_id: 'i1', tournament_id: 't1', tournament_name: 'RIVR Sunday', starts_at: '2026-11-15T10:30:00Z', member_id: 'm1', full_name: 'Kavya Rao',
    member_number: 45, created_at: '2026-11-03T10:00:00Z', registered_at: null },
  { interest_id: 'i2', tournament_id: 't1', tournament_name: 'RIVR Sunday', starts_at: '2026-11-15T10:30:00Z', member_id: 'm2', full_name: 'Rhea Kaul',
    member_number: 43, created_at: '2026-11-03T10:05:00Z', registered_at: '2026-11-03T10:20:00Z' },
];

const SUNDAY = { tournament_id: 't1', name: 'RIVR Sunday', starts_at: '2026-11-15T10:30:00Z', game: 'NLH', stake: '50/100', description: null, is_published: true, has_started: false, interested: 2, registered: 1 };
const TURBO = { tournament_id: 't2', name: 'Weeknight Turbo', starts_at: '2026-11-22T14:30:00Z', game: 'NLH', stake: '25/50', description: 'Fast.', is_published: true, has_started: false, interested: 0, registered: 0 };

let calls: { rpc: string; body: unknown }[] = [];
let published: unknown[] = [SUNDAY, TURBO];
let publishedReads = 0;

beforeEach(() => {
  calls = [];
  published = [SUNDAY, TURBO];
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const rpc = url.split('/rpc/')[1]?.split('?')[0];
    if (rpc === 'tournament_interest_list') return Response.json(INTEREST);
    if (rpc === 'published_tournaments') {
      publishedReads += 1;
      return Response.json(published);
    }
    if (url.includes('/rest/v1/staff')) {
      return Response.json([{ id: 'st1', venue_id: VENUE, full_name: 'Aditya Malhotra', role: 'admin', venue: { name: 'RIVR Gurugram', is_practice: false } }]);
    }
    if (rpc !== undefined) calls.push({ rpc, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return Response.json(rpc === undefined ? [] : null);
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

function renderList() {
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StaffVenueProvider>
        <ToastProvider place="console"><TournamentInterestScreen /></ToastProvider>
      </StaffVenueProvider>
    </RivrDataProvider>,
  );
}

describe('the Tournament interest tab (console v3)', () => {
  it('shows a card for each tournament with how many asked and how many are registered', async () => {
    renderList();
    expect(await screen.findByRole('heading', { level: 2, name: 'RIVR Sunday' })).toBeDefined();
    expect(screen.getByText('2 interested · 1 registered')).toBeDefined();
    expect(screen.getByText('Kavya Rao · No. 45')).toBeDefined();
    expect(screen.getByText('Registered')).toBeDefined();
  });

  it('marks a member registered, and Undo takes it back through its own call', async () => {
    renderList();
    fireEvent.click(await screen.findByRole('button', { name: 'Mark Kavya Rao registered' }));
    const before = publishedReads;
    expect(await screen.findByText('Kavya Rao marked registered')).toBeDefined();
    // The card's counts come from the published list, so it is read again.
    await waitFor(() => expect(publishedReads).toBeGreaterThan(before));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(calls.filter((call) => call.rpc.endsWith('tournament_registered'))).toEqual([
      { rpc: 'mark_tournament_registered', body: { p_interest_id: 'i1' } },
      { rpc: 'unmark_tournament_registered', body: { p_interest_id: 'i1' } },
    ]));
  });

  it('lists every upcoming published tournament, nobody having asked too, with Edit and Withdraw (F-027)', async () => {
    renderList();
    expect(await screen.findByRole('heading', { level: 2, name: 'Weeknight Turbo' })).toBeDefined();
    expect(screen.getByText('0 interested · 0 registered')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Edit Weeknight Turbo' })).toBeDefined();
    expect(screen.queryByText('No tournament is published.')).toBeNull();
  });

  it('says so only when none is published (F-027)', async () => {
    published = [];
    renderList();
    expect(await screen.findByText('No tournament is published.')).toBeDefined();
  });

  it('asks once more before withdrawing, then sends it (F-027)', async () => {
    renderList();
    fireEvent.click(await screen.findByRole('button', { name: 'Withdraw Weeknight Turbo' }));
    expect(calls.filter((call) => call.rpc === 'withdraw_tournament')).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, withdraw it' }));
    await waitFor(() => expect(calls.filter((call) => call.rpc === 'withdraw_tournament')).toEqual([{ rpc: 'withdraw_tournament', body: { p_tournament_id: 't2' } }]));
  });

  it('keeps a withdrawn tournament on the list, with who asked, and Publish again in place of its actions (F-027)', async () => {
    published = [{ ...SUNDAY, is_published: false }, TURBO];
    renderList();
    expect(await screen.findByText('Withdrawn')).toBeDefined();
    expect(screen.getByText('Registered')).toBeDefined();
    expect(screen.getByText('Kavya Rao · No. 45')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Mark Kavya Rao registered' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit RIVR Sunday' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Withdraw RIVR Sunday' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Publish RIVR Sunday again' }));
    await waitFor(() => expect(calls.filter((call) => call.rpc === 'publish_tournament_again')).toEqual([{ rpc: 'publish_tournament_again', body: { p_tournament_id: 't1' } }]));
  });

  it('keeps a tournament that has started, to mark whoever pays late, and it can no longer be changed (F-027)', async () => {
    published = [{ ...SUNDAY, has_started: true }];
    renderList();
    expect(await screen.findByRole('button', { name: 'Mark Kavya Rao registered' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Edit RIVR Sunday' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Withdraw RIVR Sunday' })).toBeNull();
    expect(screen.queryByText('Withdrawn')).toBeNull();
  });

  it('opens a card\u2019s details to edit, as they stand, and saves them (F-027)', async () => {
    renderList();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Weeknight Turbo' }));
    expect(screen.getAllByRole<HTMLInputElement>('textbox', { name: 'Name' }).map((field) => field.value)).toContain('Weeknight Turbo');
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(calls.find((call) => call.rpc === 'edit_published_tournament')?.body).toMatchObject({
      p_tournament_id: 't2', p_name: 'Weeknight Turbo', p_starts_at: '2026-11-22T14:30:00.000Z', p_game: 'NLH', p_stake: '25/50', p_description: 'Fast.',
    }));
  });
});

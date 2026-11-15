import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, StaffVenueProvider } from '@rivr/db';
import { ToastProvider } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TournamentsScreen } from './TournamentsScreen.tsx';

const VENUE = '00000000-0000-4000-8000-000000000001';

const SUNDAY = { tournament_id: 't1', name: 'RIVR Sunday', starts_at: '2026-11-15T10:30:00Z', game: 'No-Limit Hold’em', is_past: false, interested: 2, notified_at: null, notified: null, entries: null };
const TURBO = { tournament_id: 't2', name: 'Weeknight Turbo', starts_at: '2026-11-22T14:30:00Z', game: 'No-Limit Hold’em', is_past: false, interested: 0, notified_at: null, notified: null, entries: null };
const DIWALI = { tournament_id: 't3', name: 'Diwali Deepstack', starts_at: '2026-11-05T12:30:00Z', game: 'No-Limit Hold’em', is_past: true, interested: 96, notified_at: '2026-11-04T06:30:00Z', notified: 90, entries: null };

const ASKED = [
  { member_id: 'm1', full_name: 'Kavya Rao', member_number: 45, asked_at: '2026-11-14T10:00:00Z' },
  { member_id: 'm2', full_name: 'Rhea Kaul', member_number: 43, asked_at: '2026-11-13T10:05:00Z' },
];

const STAFF = { id: 'st1', venue_id: VENUE, full_name: 'Aditya Malhotra', role: 'admin', venue: { name: 'RIVR Gurugram', is_practice: false } };

let calls: { rpc: string; body: unknown }[] = [];
let listed: unknown[] = [];
let replies: Record<string, () => Response> = {};

/** The fake API: the staff member, what the screen reads, and any other function call as a step, recorded and answered by `replies`. */
function answer(url: string, body: unknown): Response {
  if (url.includes('/rest/v1/staff')) return Response.json([STAFF]);
  const rpc = url.split('/rpc/')[1]?.split('?')[0];
  if (rpc === undefined) return Response.json([]);
  if (rpc === 'venue_tournaments') return Response.json(listed);
  if (rpc === 'tournament_interested') return Response.json(ASKED);
  calls.push({ rpc, body: JSON.parse(String(body)) });
  const reply = replies[rpc];
  return reply === undefined ? Response.json(null) : reply();
}

beforeEach(() => {
  calls = [];
  listed = [SUNDAY, TURBO, DIWALI];
  replies = {};
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => answer(String(input instanceof Request ? input.url : input), init?.body));
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

function renderScreen(tab?: string) {
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StaffVenueProvider>
        <ToastProvider place="console"><TournamentsScreen tab={tab} onNavigate={() => undefined} /></ToastProvider>
      </StaffVenueProvider>
    </RivrDataProvider>,
  );
}

/** A row of the table by the tournament's name. */
const rowOf = async (name: string) => (await screen.findByRole('button', { name })).closest<HTMLElement>('[role="row"]') ?? document.body;

describe('Tournaments (redesign RD-26)', () => {
  it('lists those to come, with how many asked and that none is notified yet, and counts both lists', async () => {
    renderScreen();
    const sunday = within(await rowOf('RIVR Sunday'));
    expect(sunday.getByText('Sun 15 Nov, 16:00')).toBeDefined();
    expect(sunday.getByText('2')).toBeDefined();
    expect(sunday.getByText('Not yet')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Upcoming 2' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Past 1' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Diwali Deepstack' })).toBeNull();
  });

  it('lists the past ones with how many were notified', async () => {
    renderScreen('past');
    const diwali = within(await rowOf('Diwali Deepstack'));
    expect(diwali.getByText('96')).toBeDefined();
    expect(diwali.getByText('90')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'RIVR Sunday' })).toBeNull();
  });

  it('says so when none is to come', async () => {
    listed = [DIWALI];
    renderScreen();
    expect(await screen.findByText('No tournaments to come.')).toBeDefined();
  });

  it('creates one in the panel with a name, a day, a start and a game, and nowhere for money', async () => {
    replies = { publish_tournament: () => Response.json('t9') };
    renderScreen();
    fireEvent.click(await screen.findByRole('button', { name: 'New tournament' }));
    const panel = within(screen.getByRole('dialog', { name: 'New tournament' }));
    expect(panel.queryByLabelText(/buy-in|prize|guarantee|stake|fee/i)).toBeNull();
    fireEvent.change(panel.getByLabelText('Name'), { target: { value: 'Diwali Deepstack' } });
    fireEvent.change(panel.getByLabelText('Day'), { target: { value: '2026-11-29' } });
    fireEvent.change(panel.getByLabelText('Start time'), { target: { value: '16:00' } });
    fireEvent.click(panel.getByRole('radio', { name: 'Pot-Limit Omaha' }));
    fireEvent.click(panel.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(calls).toEqual([{
      rpc: 'publish_tournament', body: { p_venue_id: VENUE, p_name: 'Diwali Deepstack', p_starts_at: '2026-11-29T10:30:00.000Z', p_game: 'Pot-Limit Omaha' },
    }]));
    expect(await screen.findByText('Diwali Deepstack created')).toBeDefined();
    expect(screen.queryByRole('dialog', { name: 'New tournament' })).toBeNull();
  });

  it('says what is missing and creates nothing, and says why the club refused', async () => {
    replies = { publish_tournament: () => Response.json({ code: '22023', message: 'A start to come' }, { status: 400 }) };
    renderScreen();
    fireEvent.click(await screen.findByRole('button', { name: 'New tournament' }));
    const panel = within(screen.getByRole('dialog', { name: 'New tournament' }));
    fireEvent.click(panel.getByRole('button', { name: 'Create' }));
    expect(await panel.findByText('Give it a name of up to 80 characters.')).toBeDefined();
    expect(panel.getByText('Give a time such as 16:00.')).toBeDefined();
    expect(calls).toEqual([]);
    fireEvent.change(panel.getByLabelText('Name'), { target: { value: 'Old Cup' } });
    fireEvent.change(panel.getByLabelText('Day'), { target: { value: '2026-01-01' } });
    fireEvent.change(panel.getByLabelText('Start time'), { target: { value: '16:00' } });
    fireEvent.click(panel.getByRole('button', { name: 'Create' }));
    expect(await panel.findByText('Not saved. Choose a start still to come.')).toBeDefined();
  });

  it('opens a tournament’s record with who asked, and Notify sends the notification and says how many were told', async () => {
    replies = { notify_tournament: () => Response.json(2) };
    renderScreen();
    fireEvent.click(await screen.findByRole('button', { name: 'RIVR Sunday' }));
    const panel = within(screen.getByRole('dialog', { name: 'RIVR Sunday' }));
    expect(await panel.findByText('Kavya Rao · No. 45')).toBeDefined();
    expect(panel.getByText('Rhea Kaul · No. 43')).toBeDefined();
    fireEvent.click(panel.getByRole('button', { name: 'Notify 2' }));
    await waitFor(() => expect(calls).toEqual([{ rpc: 'notify_tournament', body: { p_tournament_id: 't1' } }]));
    expect(await screen.findByText('2 notified: RIVR Sunday')).toBeDefined();
  });

  it('offers no Notify once it is sent, nor while nobody has asked', async () => {
    listed = [{ ...SUNDAY, notified_at: '2026-11-14T06:30:00Z', notified: 2 }, TURBO];
    renderScreen();
    fireEvent.click(await screen.findByRole('button', { name: 'RIVR Sunday' }));
    const sunday = within(screen.getByRole('dialog', { name: 'RIVR Sunday' }));
    expect(sunday.queryByRole('button', { name: /^Notify/ })).toBeNull();
    fireEvent.click(sunday.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Weeknight Turbo' }));
    expect(within(screen.getByRole('dialog', { name: 'Weeknight Turbo' })).getByRole('button', { name: 'Notify 0' })).toHaveProperty('disabled', true);
  });

  it('says when nobody who asked has tournament notifications on', async () => {
    replies = { notify_tournament: () => Response.json({ code: 'RVNOB', message: 'nobody' }, { status: 400 }) };
    renderScreen();
    fireEvent.click(await screen.findByRole('button', { name: 'RIVR Sunday' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'RIVR Sunday' })).getByRole('button', { name: 'Notify 2' }));
    expect(await screen.findByText('Nobody to notify. No one who asked has tournament notifications on.')).toBeDefined();
  });

  it('asks once more before cancelling one, then sends it', async () => {
    renderScreen();
    fireEvent.click(await screen.findByRole('button', { name: 'Weeknight Turbo' }));
    const panel = within(screen.getByRole('dialog', { name: 'Weeknight Turbo' }));
    fireEvent.click(panel.getByRole('button', { name: 'Cancel tournament' }));
    expect(calls).toEqual([]);
    fireEvent.click(panel.getByRole('button', { name: 'Yes, cancel it' }));
    await waitFor(() => expect(calls).toEqual([{ rpc: 'withdraw_tournament', body: { p_tournament_id: 't2' } }]));
    expect(await screen.findByText('Weeknight Turbo cancelled')).toBeDefined();
  });

  it('takes a past one’s entries, typed, and has no Notify or Cancel tournament for it', async () => {
    renderScreen('past');
    fireEvent.click(await screen.findByRole('button', { name: 'Diwali Deepstack' }));
    const panel = within(screen.getByRole('dialog', { name: 'Diwali Deepstack' }));
    expect(panel.queryByRole('button', { name: /^Notify/ })).toBeNull();
    expect(panel.queryByRole('button', { name: 'Cancel tournament' })).toBeNull();
    fireEvent.click(panel.getByRole('button', { name: 'Save' }));
    expect(await panel.findByText('Type the entries, 0 to 100,000.')).toBeDefined();
    fireEvent.change(panel.getByLabelText('Entries'), { target: { value: '61' } });
    fireEvent.click(panel.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(calls).toEqual([{ rpc: 'set_tournament_entries', body: { p_tournament_id: 't3', p_entries: 61 } }]));
    expect(await screen.findByText('Entries saved')).toBeDefined();
  });
});

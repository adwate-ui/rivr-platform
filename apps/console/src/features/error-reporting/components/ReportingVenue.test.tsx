import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, StaffVenueProvider } from '@rivr/db';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setPracticeVenue } from '../errorReporting.ts';
import { ReportingVenue } from './ReportingVenue.tsx';

vi.mock('../errorReporting.ts', () => ({ setPracticeVenue: vi.fn() }));

const STAFF = '00000000-0000-4000-8000-000000000101';
const CLUB = { id: 's1', venue_id: 'v1', full_name: 'Vikram Rao', role: 'host', venue: { name: 'RIVR', is_practice: false } };
const PRACTICE = { id: 's2', venue_id: 'v2', full_name: 'Vikram Rao', role: 'host', venue: { name: 'RIVR Practice', is_practice: true } };

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

/** Stores a session as the client keeps one after sign-in. */
function signIn() {
  const user = { id: STAFF, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' };
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user }));
}

/** The console with an API that answers the staff read with `rows`, or never answers it. */
function renderWith(rows: unknown, { answers = true } = {}) {
  vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rest/v1/staff')) return answers ? Promise.resolve(Response.json(rows)) : new Promise<Response>(() => undefined);
    return Promise.resolve(new Response(null, { status: 204 }));
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}>
      <StaffVenueProvider><ReportingVenue /></StaffVenueProvider>
    </RivrDataProvider>,
  );
}

/** Every venue error reporting was told of, in order. */
const told = () => vi.mocked(setPracticeVenue).mock.calls.map(([isPractice]) => isPractice);

describe('ReportingVenue', () => {
  it('lets errors go for someone signed out, as the sign-in screen has no venue', async () => {
    renderWith([]);
    await waitFor(() => expect(told().at(-1)).toBe(false));
  });

  it('lets errors go for staff working in the club', async () => {
    signIn();
    renderWith([CLUB, PRACTICE]);
    await waitFor(() => expect(told()).toEqual([null, false]));
  });

  it('sends nothing while staff work in the practice venue they switched to', async () => {
    signIn();
    localStorage.setItem('rivr.console.practice-for', STAFF);
    renderWith([CLUB, PRACTICE]);
    await waitFor(() => expect(told()).toEqual([null, true]));
  });

  it('lets errors go for someone signed in who is no venue\'s staff', async () => {
    signIn();
    renderWith([]);
    await waitFor(() => expect(told()).toEqual([null, false]));
  });

  it('holds errors for as long as the venue is not known', async () => {
    signIn();
    renderWith([CLUB], { answers: false });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(told()).toEqual([null]);
  });
});

import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setPracticeVenue } from '../errorReporting.ts';
import { ReportingVenue } from './ReportingVenue.tsx';

vi.mock('../errorReporting.ts', () => ({ setPracticeVenue: vi.fn() }));

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

/** Stores a session as the client keeps one after sign-in. */
function signIn() {
  const user = { id: '00000000-0000-4000-8000-000000000202', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' };
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user }));
}

/** The app with an API that answers the member read with `member`, or never answers it. */
function renderWith(member: unknown, { answers = true } = {}) {
  vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rest/v1/member')) return answers ? Promise.resolve(Response.json(member)) : new Promise<Response>(() => undefined);
    return Promise.resolve(new Response(null, { status: 204 }));
  });
  render(<RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}><ReportingVenue /></RivrDataProvider>);
}

/** Every venue error reporting was told of, in order. */
const told = () => vi.mocked(setPracticeVenue).mock.calls.map(([isPractice]) => isPractice);

describe('ReportingVenue', () => {
  it('holds errors while the session is read, then lets them go for someone signed out', async () => {
    renderWith(null);
    await waitFor(() => expect(told()).toEqual([null, false]));
  });

  it('holds errors for as long as a signed-in member\'s venue is not known', async () => {
    signIn();
    renderWith(null, { answers: false });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(told()).toEqual([null]);
  });

  it('sends nothing for a member of the practice venue', async () => {
    signIn();
    renderWith({ id: 'm1', full_name: 'Kabir Sethi', member_number: 58, venue: { is_practice: true }, tier: { name: 'Member' } });
    await waitFor(() => expect(told()).toEqual([null, true]));
  });

  it('lets errors go for a member of the club, and for someone signed in who is joining and has no venue yet', async () => {
    signIn();
    renderWith({ id: 'm1', full_name: 'Kabir Sethi', member_number: 58, venue: { is_practice: false }, tier: { name: 'Member' } });
    await waitFor(() => expect(told()).toEqual([null, false]));
    cleanup();
    vi.clearAllMocks();
    renderWith(null);
    await waitFor(() => expect(told()).toEqual([null, false]));
  });

  it('holds errors where the venue was not read with the member, as on a phone that kept an older answer', async () => {
    signIn();
    renderWith({ id: 'm1', full_name: 'Kabir Sethi', member_number: 58, tier: { name: 'Member' } });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(told()).toEqual([null]);
  });
});

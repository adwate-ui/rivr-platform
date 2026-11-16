import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setPracticeVenue } from '../errorReporting.ts';
import { ReportingVenue } from './ReportingVenue.tsx';

vi.mock('../errorReporting.ts', () => ({ setPracticeVenue: vi.fn() }));

/** The TV's own screen, as my_tv_screen answers, with or without the venue's word (an older database gives none). */
const screen = (isPractice?: boolean) => [{
  device_id: 'd1', venue_id: 'v1', name: 'Bar TV', boards: ['waitlist'], seconds: [30], ...(isPractice === undefined ? {} : { is_practice: isPractice }),
}];

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

/** Stores a session as the client keeps one after the TV is paired. */
function signIn() {
  const user = { id: '00000000-0000-4000-8000-00000000e001', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' };
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user }));
}

/** The TV with an API that answers its screen read with `rows`, or never answers it. */
function renderWith(rows: unknown, { answers = true } = {}) {
  vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rest/v1/rpc/my_tv_screen')) return answers ? Promise.resolve(Response.json(rows)) : new Promise<Response>(() => undefined);
    return Promise.resolve(new Response(null, { status: 204 }));
  });
  render(<RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}><ReportingVenue /></RivrDataProvider>);
}

/** Every venue error reporting was told of, in order. */
const told = () => vi.mocked(setPracticeVenue).mock.calls.map(([isPractice]) => isPractice);

describe('ReportingVenue', () => {
  it('lets errors go for a TV showing its pairing code, which has no venue', async () => {
    renderWith([]);
    await waitFor(() => expect(told().at(-1)).toBe(false));
  });

  it('lets errors go for a TV paired to the club', async () => {
    signIn();
    renderWith(screen(false));
    await waitFor(() => expect(told()).toEqual([null, false]));
  });

  it('sends nothing from a TV paired to the practice venue, or from one whose database gives no word on it', async () => {
    signIn();
    renderWith(screen(true));
    await waitFor(() => expect(told()).toEqual([null, true]));
    cleanup();
    vi.clearAllMocks();
    renderWith(screen());
    await waitFor(() => expect(told().at(-1)).toBe(true));
  });

  it('holds errors for as long as the screen is not known', async () => {
    signIn();
    renderWith(screen(false), { answers: false });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(told()).toEqual([null]);
  });
});

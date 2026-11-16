import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setPracticeVenue } from '../errorReporting.ts';
import { ReportingVenue } from './ReportingVenue.tsx';

vi.mock('../errorReporting.ts', () => ({ setPracticeVenue: vi.fn() }));

/** The tablet's own row, as my_device answers, in a venue that is or is not the practice one. */
const device = (isPractice: boolean) => [{ device_id: 'd1', venue_id: 'v1', name: 'Table 3 tablet', table_id: 't3', table_name: 'Table 3', is_practice: isPractice }];

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

/** Stores a session as the client keeps one after the tablet is paired. */
function signIn() {
  const user = { id: '00000000-0000-4000-8000-00000000d001', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' };
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user }));
}

/** The tablet with an API that answers its device read with `rows`, or never answers it. */
function renderWith(rows: unknown, { answers = true } = {}) {
  vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rest/v1/rpc/my_device')) return answers ? Promise.resolve(Response.json(rows)) : new Promise<Response>(() => undefined);
    return Promise.resolve(new Response(null, { status: 204 }));
  });
  render(<RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}><ReportingVenue /></RivrDataProvider>);
}

/** Every venue error reporting was told of, in order. */
const told = () => vi.mocked(setPracticeVenue).mock.calls.map(([isPractice]) => isPractice);

describe('ReportingVenue', () => {
  it('lets errors go for a tablet not yet paired, which has no venue', async () => {
    renderWith([]);
    await waitFor(() => expect(told().at(-1)).toBe(false));
  });

  it('lets errors go for a tablet paired to the club', async () => {
    signIn();
    renderWith(device(false));
    await waitFor(() => expect(told()).toEqual([null, false]));
  });

  it('sends nothing from a tablet paired to the practice venue', async () => {
    signIn();
    renderWith(device(true));
    await waitFor(() => expect(told()).toEqual([null, true]));
  });

  it('lets errors go for a session that is no device\'s', async () => {
    signIn();
    renderWith([]);
    await waitFor(() => expect(told()).toEqual([null, false]));
  });

  it('holds errors for as long as the device is not known', async () => {
    signIn();
    renderWith(device(false), { answers: false });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(told()).toEqual([null]);
  });
});

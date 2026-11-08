import { createClient } from '@supabase/supabase-js';
import { QueryClient } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { useStaffVenues } from './staff.tsx';
import { useSetStaffDensity, useSetStaffShortcuts, useStaffDensity, useStaffShortcuts } from './staffPreference.ts';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const SANA = '00000000-0000-4000-8000-000000000104';
const STAFF = [
  { id: 's1', venue_id: 'v1', full_name: 'Sana Qureshi', role: 'cashier', venue: { name: 'RIVR Gurugram', is_practice: false } },
  { id: 's2', venue_id: 'v2', full_name: 'Sana Qureshi', role: 'cashier', venue: { name: 'RIVR Practice', is_practice: true } },
];

interface Sent {
  readonly method: string;
  readonly url: string;
  readonly body: unknown;
}

/** Sana signed in, a fake API whose preference read answers `stored` and whose write answers `writeStatus`. */
function renderDensity(stored: unknown, writeStatus = 201) {
  const sent: Sent[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(String(input), init);
    const body: unknown = request.method === 'GET' ? null : JSON.parse(await request.text());
    sent.push({ method: request.method, url: request.url, body });
    if (request.url.includes('/rest/v1/staff?')) return Response.json(STAFF);
    if (request.method === 'GET') return Response.json(stored);
    return new Response(writeStatus < 300 ? null : JSON.stringify({ message: 'refused' }), { status: writeStatus });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(SANA), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client} queryClient={queryClient}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({
    density: useStaffDensity('v1'), set: useSetStaffDensity(), venues: useStaffVenues(),
    shortcuts: useStaffShortcuts('v1'), setShortcuts: useSetStaffShortcuts(),
  }), { wrapper });
  return { result, sent };
}

afterEach(cleanup);

describe('the console density', () => {
  it('is comfortable until the staff member chooses', async () => {
    const { result } = renderDensity(null);
    await waitFor(() => expect(result.current.density.data).toBe('comfortable'));
  });

  it('reads the staff member’s own choice at the venue', async () => {
    const { result, sent } = renderDensity({ density: 'compact' });
    await waitFor(() => expect(result.current.density.data).toBe('compact'));
    expect(sent.find((one) => one.url.includes('/staff_preference'))?.url).toContain('venue_id=eq.v1');
  });

  it('keeps a choice at every venue where they are staff, shown at once', async () => {
    const { result, sent } = renderDensity(null);
    await waitFor(() => expect(result.current.venues.data).toHaveLength(2));
    await waitFor(() => expect(result.current.density.data).toBe('comfortable'));
    let outcome: unknown;
    await act(async () => { outcome = await result.current.set.mutateAsync('compact'); });
    expect(outcome).toEqual({ ok: true, value: 'compact' });
    const write = sent.find((one) => one.method === 'POST' && one.url.includes('/staff_preference'));
    expect(write?.url).toContain('on_conflict=staff_id');
    expect(write?.body).toEqual([{ staff_id: 's1', venue_id: 'v1', density: 'compact' }, { staff_id: 's2', venue_id: 'v2', density: 'compact' }]);
    await waitFor(() => expect(result.current.density.data).toBe('compact'));
  });

  it('says so when the choice is refused, and reads the stored one again', async () => {
    const { result } = renderDensity(null, 500);
    await waitFor(() => expect(result.current.venues.data).toHaveLength(2));
    let outcome: unknown;
    await act(async () => { outcome = await result.current.set.mutateAsync('compact'); });
    expect(outcome).toEqual({ ok: false, error: 'unavailable' });
    await waitFor(() => expect(result.current.density.data).toBe('comfortable'));
  });
});

describe('the keyboard shortcuts switch (WCAG 2.1.4)', () => {
  it('is on until the staff member turns it off', async () => {
    const { result } = renderDensity(null);
    await waitFor(() => expect(result.current.shortcuts.data).toBe(true));
  });

  it('reads the staff member’s own switch at the venue', async () => {
    const { result } = renderDensity({ has_shortcuts: false });
    await waitFor(() => expect(result.current.shortcuts.data).toBe(false));
  });

  it('keeps the switch at every venue where they are staff, shown at once, and puts it back if refused', async () => {
    const { result, sent } = renderDensity(null);
    await waitFor(() => expect(result.current.venues.data).toHaveLength(2));
    await waitFor(() => expect(result.current.shortcuts.data).toBe(true));
    let outcome: unknown;
    await act(async () => { outcome = await result.current.setShortcuts.mutateAsync(false); });
    expect(outcome).toEqual({ ok: true, value: false });
    const write = sent.find((one) => one.method === 'POST' && one.url.includes('/staff_preference'));
    expect(write?.body).toEqual([{ staff_id: 's1', venue_id: 'v1', has_shortcuts: false }, { staff_id: 's2', venue_id: 'v2', has_shortcuts: false }]);
    await waitFor(() => expect(result.current.shortcuts.data).toBe(false));

    const refused = renderDensity(null, 500);
    await waitFor(() => expect(refused.result.current.venues.data).toHaveLength(2));
    await act(async () => { outcome = await refused.result.current.setShortcuts.mutateAsync(false); });
    expect(outcome).toEqual({ ok: false, error: 'unavailable' });
    await waitFor(() => expect(refused.result.current.shortcuts.data).toBe(true));
  });
});

import { createClient } from '@supabase/supabase-js';
import { QueryClient } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider, useAuthStatus } from './provider.tsx';
import { useSignOut } from './signIn.ts';
import { StaffVenueProvider, useStaffVenue } from './staff.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const SANA = '00000000-0000-4000-8000-000000000104';

const PRACTICE_ROW = { id: 's2', venue_id: 'v2', full_name: 'Sana Qureshi', role: 'cashier', venue: { name: 'RIVR Practice', is_practice: true } };
const CLUB_ROW = { id: 's1', venue_id: 'v1', full_name: 'Sana Qureshi', role: 'cashier', venue: { name: 'RIVR Gurugram', is_practice: false } };

/** A fake API: each path answers with its reply; the calls are recorded. */
function renderStaff(replies: Record<string, { status?: number; body: unknown }>) {
  const calls: string[] = [];
  const fetch: typeof globalThis.fetch = async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push(url);
    const path = Object.keys(replies).find((key) => url.includes(key));
    const reply = path ? replies[path] : undefined;
    const status = reply?.status ?? 200;
    return new Response(status === 204 ? null : JSON.stringify(reply?.body ?? null), { status, headers: { 'content-type': 'application/json' } });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(SANA), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RivrDataProvider client={client} queryClient={queryClient}>
      <StaffVenueProvider>{children}</StaffVenueProvider>
    </RivrDataProvider>
  );
  const { result } = renderHook(() => ({ staff: useStaffVenue(), auth: useAuthStatus(), signOut: useSignOut() }), { wrapper });
  return { result, calls };
}

afterEach(cleanup);

describe('the console venue', () => {
  it('is the club, with what the role allows, until the staff member switches to the practice venue', async () => {
    const { result } = renderStaff({ '/rest/v1/staff': { body: [PRACTICE_ROW, CLUB_ROW] } });

    await waitFor(() => expect(result.current.staff.status).toBe('ready'));
    const ready = () => {
      const { staff } = result.current;
      if (staff.status !== 'ready') throw new Error(`expected ready, got ${staff.status}`);
      return staff;
    };
    expect(ready().venue).toMatchObject({ venueId: 'v1', venueName: 'RIVR Gurugram', isPractice: false, fullName: 'Sana Qureshi', role: 'cashier' });
    expect(ready().venue.permissions).toContain('cage.transact');
    expect(ready().venue.permissions).not.toContain('members.manage');
    expect(ready().canPractise).toBe(true);

    act(() => ready().setPractice(true));
    expect(ready().venue).toMatchObject({ venueId: 'v2', isPractice: true });
    act(() => ready().setPractice(false));
    expect(ready().venue.venueId).toBe('v1');
  });

  it('is nobody\'s for someone who is not active staff', async () => {
    const { result } = renderStaff({ '/rest/v1/staff': { body: [] } });
    await waitFor(() => expect(result.current.staff.status).toBe('not-staff'));
  });

  it('says so when the staff list cannot load', async () => {
    const { result } = renderStaff({ '/rest/v1/staff': { status: 500, body: { message: 'down' } } });
    await waitFor(() => expect(result.current.staff.status).toBe('error'));
  });
});

describe('signing out', () => {
  it('ends the session on this device', async () => {
    const { result, calls } = renderStaff({ '/rest/v1/staff': { body: [CLUB_ROW] }, '/auth/v1/logout': { status: 204, body: null } });
    await waitFor(() => expect(result.current.auth).toBe('signed-in'));

    await act(() => result.current.signOut.mutateAsync());

    await waitFor(() => expect(result.current.auth).toBe('signed-out'));
    expect(calls.find((url) => url.includes('/auth/v1/logout'))).toContain('scope=local');
  });
});

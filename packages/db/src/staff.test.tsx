import { indianMobileSchema } from '@rivr/contracts';
import { createClient } from '@supabase/supabase-js';
import { QueryClient } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { useSignIn, useSignOut } from './signIn.ts';
import { StaffVenueProvider, useStaffVenue } from './staff.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const SANA = '00000000-0000-4000-8000-000000000104';

// The staff rows PostgREST answers with: Sana is a cashier at the club and at the practice venue.
const PRACTICE_ROW = { id: 's2', venue_id: 'v2', full_name: 'Sana Qureshi', role: 'cashier', venue: { name: 'RIVR Practice', is_practice: true } };
const CLUB_ROW = { id: 's1', venue_id: 'v1', full_name: 'Sana Qureshi', role: 'cashier', venue: { name: 'RIVR Gurugram', is_practice: false } };

type Reply = { status?: number; body: unknown };

/** A fake API answering the staff read with `staff` and other paths from `others`, for Sana signed in. */
function renderStaff(staff: Reply, others: Record<string, Reply> = {}) {
  const replies: Record<string, Reply> = { '/rest/v1/staff': staff, ...others };
  const fetch: typeof globalThis.fetch = async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    const path = Object.keys(replies).find((key) => url.includes(key));
    const reply = path ? replies[path] : { body: [] };
    const status = reply?.status ?? 200;
    return new Response(status === 204 ? null : JSON.stringify(reply?.body), { status, headers: { 'content-type': 'application/json' } });
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
  const { result } = renderHook(() => ({ staff: useStaffVenue(), signIn: useSignIn(), signOut: useSignOut() }), { wrapper });
  const ready = () => {
    if (result.current.staff.status !== 'ready') throw new Error(`expected ready, got ${result.current.staff.status}`);
    return result.current.staff;
  };
  return { result, ready };
}

afterEach(cleanup);

describe('the console venue', () => {
  it('is the club, with what the role allows, until the staff member switches to the practice venue', async () => {
    const { result, ready } = renderStaff({ body: [PRACTICE_ROW, CLUB_ROW] });

    await waitFor(() => expect(result.current.staff.status).toBe('ready'));
    expect(ready().venue).toMatchObject({ venueId: 'v1', venueName: 'RIVR Gurugram', isPractice: false, fullName: 'Sana Qureshi', role: 'cashier' });
    expect(ready().venue.permissions).toContain('cage.transact');
    expect(ready().venue.permissions).not.toContain('members.manage');
    expect(ready().canPractise).toBe(true);

    act(() => ready().setPractice(true));
    expect(ready().venue).toMatchObject({ venueId: 'v2', isPractice: true });
    act(() => ready().setPractice(false));
    expect(ready().venue.venueId).toBe('v1');
  });

  it('starts at the club again after signing out, even for the same person', async () => {
    const session = {
      access_token: 'access', refresh_token: 'refresh', token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: SANA, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
    };
    const { result, ready } = renderStaff({ body: [PRACTICE_ROW, CLUB_ROW] }, {
      '/auth/v1/logout': { status: 204, body: null },
      '/auth/v1/verify': { body: session },
      '/rpc/link_my_login': { body: null },
    });
    await waitFor(() => expect(result.current.staff.status).toBe('ready'));
    act(() => ready().setPractice(true));
    expect(ready().venue.isPractice).toBe(true);

    await act(() => result.current.signOut.mutateAsync());
    await act(() => result.current.signIn.verifyCode.mutateAsync({ phone: indianMobileSchema.parse('9000000104'), code: '123456' }));

    await waitFor(() => expect(result.current.staff.status).toBe('ready'));
    expect(ready().venue).toMatchObject({ venueId: 'v1', isPractice: false });
  });

  it('is nobody\'s for someone who is not active staff', async () => {
    const { result } = renderStaff({ body: [] });
    await waitFor(() => expect(result.current.staff.status).toBe('not-staff'));
  });

  it('says so when the staff list cannot load', async () => {
    const { result } = renderStaff({ status: 500, body: { message: 'down' } });
    await waitFor(() => expect(result.current.staff.status).toBe('error'));
  });
});

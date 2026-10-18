import { createClient } from '@supabase/supabase-js';
import { QueryClient } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { StaffVenueProvider, useStaffVenue } from './staff.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const SANA = '00000000-0000-4000-8000-000000000104';

// The staff rows PostgREST answers with: Sana is a cashier at the club and at the practice venue.
const PRACTICE_ROW = { id: 's2', venue_id: 'v2', full_name: 'Sana Qureshi', role: 'cashier', venue: { name: 'RIVR Practice', is_practice: true } };
const CLUB_ROW = { id: 's1', venue_id: 'v1', full_name: 'Sana Qureshi', role: 'cashier', venue: { name: 'RIVR Gurugram', is_practice: false } };

/** A fake API answering the staff read with `reply`, for Sana signed in. */
function renderStaff(reply: { status?: number; body: unknown }) {
  const fetch: typeof globalThis.fetch = async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    const answer = url.includes('/rest/v1/staff') ? reply : { body: [] };
    return Response.json(answer.body, { status: answer.status ?? 200 });
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
  return renderHook(() => useStaffVenue(), { wrapper });
}

afterEach(cleanup);

describe('the console venue', () => {
  it('is the club, with what the role allows, until the staff member switches to the practice venue', async () => {
    const { result } = renderStaff({ body: [PRACTICE_ROW, CLUB_ROW] });

    await waitFor(() => expect(result.current.status).toBe('ready'));
    const ready = () => {
      if (result.current.status !== 'ready') throw new Error(`expected ready, got ${result.current.status}`);
      return result.current;
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
    const { result } = renderStaff({ body: [] });
    await waitFor(() => expect(result.current.status).toBe('not-staff'));
  });

  it('says so when the staff list cannot load', async () => {
    const { result } = renderStaff({ status: 500, body: { message: 'down' } });
    await waitFor(() => expect(result.current.status).toBe('error'));
  });
});

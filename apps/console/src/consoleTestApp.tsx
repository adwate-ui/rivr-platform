import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, StaffVenueProvider } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { createAppRouter } from './router.tsx';

/*
 * The console as a test opens it: a session stored as sign-in keeps one, a fake API, and the app's router at an address.
 * Shared by the app's tests (app.test.tsx, shell.test.tsx).
 */

/** Stores a session as the client keeps one after sign-in (under SESSION_STORAGE_KEY), for Sana, a cashier. */
export function signIn() {
  const session = {
    access_token: 'test',
    refresh_token: 'test',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000104', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  };
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export const CLUB = { id: 's1', venue_id: 'v1', full_name: 'Sana Qureshi', role: 'cashier', venue: { name: 'RIVR Gurugram', is_practice: false } };
export const PRACTICE = { id: 's2', venue_id: 'v2', full_name: 'Sana Qureshi', role: 'cashier', venue: { name: 'RIVR Practice', is_practice: true } };

/** Sana at the club, and a fake API whose given reads answer once, then fail: a refresh that cannot reach the API. */
export function answerOnceThenFail(first: Record<string, unknown>) {
  const asked = new Map<string, number>();
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rest/v1/staff')) return Response.json([CLUB]);
    const path = Object.keys(first).find((candidate) => url.includes(candidate));
    if (path === undefined) return Response.json([]);
    const times = (asked.get(path) ?? 0) + 1;
    asked.set(path, times);
    return times === 1 ? Response.json(first[path]) : Response.json({ message: 'unreachable' }, { status: 503 });
  });
}

/** A fake API: the staff records it is given (or a failure), and nothing for anything else. */
export function answerStaff(staff: unknown[], status = 200) {
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    return url.includes('/rest/v1/staff') ? Response.json(staff, { status }) : Response.json([]);
  });
}

/** The console at `path`, with a fresh client and query cache. */
export function renderAt(path: string) {
  // Created after the fetch is faked, so the client uses the fake.
  const client = createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <RivrDataProvider client={client} queryClient={queryClient}>
      <StaffVenueProvider>
        <RouterProvider router={createAppRouter(createMemoryHistory({ initialEntries: [path] }))} />
      </StaffVenueProvider>
    </RivrDataProvider>,
  );
}

// Sign-in is loaded lazily: the first test to open it waits for its module, which a busy CI runner
// can take more than findBy's default second to load.
export const LAZY_SCREEN = { timeout: 5000 };

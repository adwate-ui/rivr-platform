import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, StaffVenueProvider } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAppRouter } from './router.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** Stores a session as the client keeps one after sign-in (under SESSION_STORAGE_KEY), for Sana, a cashier. */
function signIn() {
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

const CLUB = { id: 's1', venue_id: 'v1', full_name: 'Sana Qureshi', role: 'cashier', venue: { name: 'RIVR Gurugram', is_practice: false } };
const PRACTICE = { id: 's2', venue_id: 'v2', full_name: 'Sana Qureshi', role: 'cashier', venue: { name: 'RIVR Practice', is_practice: true } };

/** A fake API: the staff records it is given (or a failure), and nothing for anything else. */
function answerStaff(staff: unknown[], status = 200) {
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    return url.includes('/rest/v1/staff') ? Response.json(staff, { status }) : Response.json([]);
  });
}

function renderAt(path: string) {
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
const LAZY_SCREEN = { timeout: 5000 };

describe('the console', () => {
  it('sends someone signed out to sign-in', async () => {
    renderAt('/');
    expect(await screen.findByRole('textbox', { name: 'Mobile number' }, LAZY_SCREEN)).toBeDefined();
  });

  it('shows in the rail only the screens the role allows: the cage\'s for a cashier', async () => {
    signIn();
    answerStaff([CLUB]);
    renderAt('/');
    expect(await screen.findByRole('link', { name: 'Academy payments' })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Academy' })).toBeNull();
  });

  it('and Academy staff\'s for an admin', async () => {
    signIn();
    answerStaff([{ ...CLUB, full_name: 'Aditya Malhotra', role: 'admin' }]);
    renderAt('/');
    expect(await screen.findByRole('link', { name: 'Academy' })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Academy payments' })).toBeNull();
  });

  it('refuses a screen the role does not include, opened by its address', async () => {
    signIn();
    answerStaff([CLUB]);
    renderAt('/academy');
    expect(await screen.findByText('Your role does not include this screen. Ask an admin if you need it.')).toBeDefined();
  });

  it('opens on Live floor for staff, with the rail, who is signed in and the venue', async () => {
    signIn();
    answerStaff([CLUB, PRACTICE]);
    renderAt('/');
    expect(await screen.findByRole('heading', { name: 'Live floor' })).toBeDefined();
    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Live floor' })).toBeDefined();
    expect(screen.getByText('Sana Qureshi')).toBeDefined();
    expect(screen.getByText('RIVR Gurugram')).toBeDefined();
  });

  it('switches to the practice venue and back', async () => {
    signIn();
    answerStaff([CLUB, PRACTICE]);
    renderAt('/');
    fireEvent.click(await screen.findByRole('switch', { name: 'Practice venue' }));
    expect(await screen.findByText('RIVR Practice')).toBeDefined();
    fireEvent.click(screen.getByRole('switch', { name: 'Practice venue' }));
    expect(await screen.findByText('RIVR Gurugram')).toBeDefined();
  });

  it('has no practice switch for someone who is staff at the club only', async () => {
    signIn();
    answerStaff([CLUB]);
    renderAt('/');
    await screen.findByText('RIVR Gurugram');
    expect(screen.queryByRole('switch', { name: 'Practice venue' })).toBeNull();
  });

  it('turns away someone who is not staff, who can only sign out', async () => {
    signIn();
    answerStaff([]);
    renderAt('/');
    expect(await screen.findByRole('heading', { name: 'Staff only' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeDefined();
    expect(screen.queryByRole('navigation', { name: 'Sections' })).toBeNull();
  });

  it('says so when the staff record cannot load, and still offers sign out', async () => {
    signIn();
    answerStaff([], 500);
    renderAt('/');
    expect(await screen.findByText('Could not load this. Check the connection and try again.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeDefined();
  });

  it('says so when a page does not exist', async () => {
    signIn();
    answerStaff([CLUB]);
    renderAt('/nowhere');
    expect(await screen.findByText('This page does not exist.')).toBeDefined();
  });
});

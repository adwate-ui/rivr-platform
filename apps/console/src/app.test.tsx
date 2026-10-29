import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, StaffVenueProvider } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

/**
 * A fake Auth that accepts the code, and an API that fails linking the login to its staff record
 * once the test lets it answer: until then the person is signed in but still checking their code.
 */
function answerSignInThenFailLinking(): () => void {
  let answerLinking: () => void = () => undefined;
  const linking = new Promise<void>((resolve) => {
    answerLinking = resolve;
  });
  const session = {
    access_token: 'test',
    refresh_token: 'test',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000104', aud: 'authenticated', role: 'authenticated', phone: '919876543210', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  };
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/auth/v1/otp')) return Response.json({});
    if (url.includes('/auth/v1/verify')) return Response.json(session);
    if (url.includes('/rpc/link_my_login')) {
      await linking;
      return Response.json({ message: 'unavailable' }, { status: 500 });
    }
    return Response.json([]);
  });
  return answerLinking;
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

  it('shows in the rail only the screens the role allows, and none of the cage\'s, which are hidden', async () => {
    signIn();
    answerStaff([CLUB]);
    renderAt('/');
    expect(await screen.findByRole('link', { name: 'Live floor' })).toBeDefined();
    for (const hidden of ['Cage', 'Academy payments', 'Academy']) expect(screen.queryByRole('link', { name: hidden })).toBeNull();
    expect(screen.queryByRole('link', { name: 'KYC review' })).toBeNull();
  });

  it('and KYC review for an admin, but no Academy', async () => {
    signIn();
    answerStaff([{ ...CLUB, full_name: 'Aditya Malhotra', role: 'admin' }]);
    renderAt('/');
    expect(await screen.findByRole('link', { name: 'KYC review' })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Academy' })).toBeNull();
  });

  it('refuses a screen the role does not include, opened by its address', async () => {
    signIn();
    answerStaff([CLUB]);
    renderAt('/academy');
    expect(await screen.findByText('Your role does not include this screen. Ask an admin if you need it.')).toBeDefined();
  });

  // Screens merged into others (#606): each old address opens its tab.
  it.each([['/tablets', 'Tablets'], ['/tvs', 'TVs'], ['/dealer-pins', 'Dealer PINs']])('opens %s as its tab, %s, for a super admin', async (path, tab) => {
    signIn();
    answerStaff([{ ...CLUB, full_name: 'Vikram Rao', role: 'super_admin' }]);
    renderAt(path);
    expect(await screen.findByRole('link', { name: tab, current: 'page' })).toBeDefined();
  });

  // The old addresses of tabs the owner hid (#626): none opens its tab, a super admin's either.
  it.each([
    ['/computers', 'Computers'], ['/cameras', 'Cameras'], ['/high-hands', 'High hands'], ['/treasury', 'Opening and counts'],
    ['/end-of-day', 'Closing and history'], ['/rake', 'Rake and jackpots'],
  ])('does not open %s as its tab, %s, which is hidden', async (path, tab) => {
    signIn();
    answerStaff([{ ...CLUB, full_name: 'Vikram Rao', role: 'super_admin' }]);
    renderAt(path);
    expect(await screen.findByRole('link', { name: 'Live floor' })).toBeDefined();
    expect(screen.queryByRole('link', { name: tab })).toBeNull();
  });

  it.each(['/dealer-pins', '/tablets', '/computers'])('still refuses a cashier at %s, once it has opened the screen it moved to', async (path) => {
    signIn();
    answerStaff([CLUB]);
    renderAt(path);
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

  it('says who is signed in when sign-in is opened over a live session, instead of the form', async () => {
    signIn();
    answerStaff([CLUB]);
    renderAt('/sign-in');
    expect(await screen.findByText('Sana Qureshi is signed in on this device.', {}, LAZY_SCREEN)).toBeDefined();
    expect(screen.queryByRole('textbox', { name: 'Mobile number' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Continue as Sana Qureshi' }));
    expect(await screen.findByRole('heading', { name: 'Live floor' })).toBeDefined();
  });

  it('never offers a way in before it knows whose console it is', async () => {
    signIn();
    answerStaff([], 500);
    renderAt('/sign-in');
    expect(await screen.findByText('Someone is signed in on this device.', {}, LAZY_SCREEN)).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Continue/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeDefined();
  });

  it('never says someone is signed in while their own code is being checked', async () => {
    // The code is right, so Auth signs in, but linking the staff record fails and signs out again.
    const answerLinking = answerSignInThenFailLinking();
    renderAt('/sign-in');
    fireEvent.change(await screen.findByRole('textbox', { name: 'Mobile number' }, LAZY_SCREEN), { target: { value: '9876543210' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    fireEvent.change(await screen.findByRole('textbox', { name: /^Code sent to/ }), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    // Signed in by Auth while the staff record is still being linked: the code step stays.
    await waitFor(() => expect(localStorage.getItem(SESSION_STORAGE_KEY)).not.toBeNull());
    await new Promise((settle) => setTimeout(settle, 50));
    expect(screen.queryByText(/is signed in on this device/)).toBeNull();
    expect(screen.getByRole('textbox', { name: /^Code sent to/ })).toBeDefined();
    answerLinking();
    expect(await screen.findByText('Sign-in is not available right now. Try again in a few minutes.')).toBeDefined();
  });

  it('lets the next person sign in once the live session signs out', async () => {
    signIn();
    answerStaff([CLUB]);
    renderAt('/sign-in');
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }, LAZY_SCREEN));
    expect(await screen.findByRole('textbox', { name: 'Mobile number' })).toBeDefined();
  });

  it('says so when a page does not exist', async () => {
    signIn();
    answerStaff([CLUB]);
    renderAt('/nowhere');
    expect(await screen.findByText('This page does not exist.')).toBeDefined();
  });
});

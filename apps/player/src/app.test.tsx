import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startInstallWatch } from './features/frame/index.ts';
import { createAppRouter } from './router.tsx';

afterEach(() => {
  // Back online while the app is still mounted, so the query client hears it: a client that thinks
  // it is offline holds every later request.
  goOnline(true);
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** Tells the app the phone has, or has lost, its connection. */
function goOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true });
  window.dispatchEvent(new Event(online ? 'online' : 'offline'));
}

/** Stores a session as the client keeps one after sign-in (under SESSION_STORAGE_KEY), for Kabir. */
function signIn({ expired = false } = {}) {
  const session = {
    access_token: 'test',
    refresh_token: 'test',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + (expired ? -60 : 3600),
    user: { id: '00000000-0000-4000-8000-000000000202', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  };
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

// Nothing listens at this address: signed out, nothing is fetched, and a sign-in request fails.
const client = createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' });

/** Kabir's tier has the live floor, so Home lists tonight's tables (none in these tests). */
const KABIRS_FEATURES = [{ feature_key: 'floor.live_view', state: 'enabled', tiers: null }];

/**
 * A client whose API answers Kabir's member record and features, and an empty list to all else;
 * created after the fake fetch.
 */
function clientWithKabir() {
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/my_feature_access')) return Response.json(KABIRS_FEATURES);
    return Response.json(url.includes('/rest/v1/member') ? { id: 'm1', full_name: 'Kabir Sethi' } : []);
  });
  return createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' });
}

/** Opens the app at `path`; the router tells a test where the app went. */
function renderAt(path: string, rivr = client) {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
  render(
    <RivrDataProvider client={rivr}>
      <RouterProvider router={router} />
    </RivrDataProvider>,
  );
  return router;
}

// The watch main.tsx starts keeps the browser's install prompt; started once here, as at app start.
startInstallWatch();

/** The browser offering to install the app, as Chromium does once a page qualifies. */
function browserOffersInstall() {
  const prompt = vi.fn(async () => undefined);
  act(() => {
    window.dispatchEvent(Object.assign(new Event('beforeinstallprompt'), { prompt }));
  });
  return prompt;
}

/** Kabir, a member, opening the app at `path` on his `visit`th visit. */
async function memberOpens(path: string, visit: number) {
  signIn();
  localStorage.setItem('rivr-visits', String(visit));
  renderAt(path, clientWithKabir());
  // A screen loads its module when first opened, which can take CI's runner over a second.
  await screen.findByRole('navigation', { name: 'Main' }, { timeout: 5000 });
}

describe('the install offer', () => {
  const offer = () => screen.queryByRole('region', { name: 'RIVR on your home screen' });

  it('is never made on a member\'s first visit, nor on any screen but Tonight', async () => {
    await memberOpens('/', 1);
    browserOffersInstall();
    expect(offer()).toBeNull();
    cleanup();
    await memberOpens('/rewards', 2);
    expect(offer()).toBeNull();
  });

  it('is made on Tonight from the second visit, and Not now puts it away for good', async () => {
    await memberOpens('/', 2);
    browserOffersInstall();
    fireEvent.click(await screen.findByRole('button', { name: 'Not now' }));
    expect(offer()).toBeNull();
    expect(localStorage.getItem('rivr-install-dismissed')).toBe('1');
  });

  it('asks the browser to install, and is not made again whatever the answer', async () => {
    await memberOpens('/', 2);
    const prompt = browserOffersInstall();
    fireEvent.click(await screen.findByRole('button', { name: 'Install' }));
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(offer()).toBeNull();
    expect(localStorage.getItem('rivr-install-dismissed')).toBe('1');
  });
});

describe('the player app', () => {
  it('says it is offline above the screen while the phone has no connection', async () => {
    signIn();
    renderAt('/', clientWithKabir());
    await screen.findByText('No tables are running.');
    expect(screen.queryByText('Offline. What you see may be out of date.')).toBeNull();
    act(() => goOnline(false));
    expect(screen.getByRole('status').textContent).toBe('Offline. What you see may be out of date.');
  });

  it('opens on Tonight inside the frame', async () => {
    signIn();
    renderAt('/', clientWithKabir());
    expect(await screen.findByRole('heading', { name: 'Tonight' })).toBeDefined();
    expect(await screen.findByText('No tables are running.')).toBeDefined();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeDefined();
  });

  it('keeps gated tabs out of the tab bar until the member’s access is known', async () => {
    signIn();
    renderAt('/');
    await screen.findByRole('heading', { name: 'Tonight' });
    expect(screen.getByRole('link', { name: 'Rewards' })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Learn' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Sessions' })).toBeNull();
  });

  it('has no Balance tab, and its old addresses open Tonight', async () => {
    signIn();
    const router = renderAt('/balance/deposit', clientWithKabir());
    expect(await screen.findByRole('heading', { name: 'Tonight' })).toBeDefined();
    expect(router.state.location.pathname).toBe('/');
    expect(screen.queryByRole('link', { name: 'Balance' })).toBeNull();
  });

  it.each(['/academy', '/academy/b1', '/academy/b1/invoice'])('sends the Academy’s old address %s to Learn, as the app takes no payments', async (address) => {
    signIn();
    const router = renderAt(address, clientWithKabir());
    await waitFor(() => expect(router.state.location.pathname).toBe('/learn'));
  });

  it('shows no Learn screen to someone without access', async () => {
    signIn();
    renderAt('/learn');
    await screen.findByRole('navigation', { name: 'Main' });
    expect(screen.queryByRole('heading', { name: 'Learn' })).toBeNull();
  });

  it('says so when a page does not exist', async () => {
    signIn();
    renderAt('/nowhere');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeDefined();
    expect(screen.getByText('This page does not exist.')).toBeDefined();
    expect(screen.getAllByRole('navigation', { name: 'Main' })).toHaveLength(1);
  });
});

// Sign-in is loaded lazily: the first test to open it waits for its module, which a busy CI runner
// can take more than findBy's default second to load.
const LAZY_SCREEN = { timeout: 5000 };

describe('sign-in', () => {
  it('is where anyone signed out goes', async () => {
    const router = renderAt('/');
    expect(await screen.findByRole('textbox', { name: 'Mobile number' }, LAZY_SCREEN)).toBeDefined();
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
    expect(router.state.location.search).not.toHaveProperty('next');
  });

  it('keeps the screen a link pointed at, to open once signed in', async () => {
    const router = renderAt('/rewards?ref=FRIEND1');
    expect(await screen.findByRole('textbox', { name: 'Mobile number' }, LAZY_SCREEN)).toBeDefined();
    expect(router.state.location.pathname).toBe('/sign-in');
    expect(router.state.location.search).toEqual({ next: '/rewards' });
  });

  it('never keeps an address outside the app', async () => {
    const router = renderAt('/sign-in?next=%2F%2Fevil.example');
    expect(await screen.findByRole('textbox', { name: 'Mobile number' }, LAZY_SCREEN)).toBeDefined();
    // What the sign-in screen reads: the route's checked search.
    expect(router.state.matches.at(-1)?.search).toMatchObject({ next: undefined });
  });

  it('is where identity sends someone signed out, to come back to it', async () => {
    const router = renderAt('/kyc');
    expect(await screen.findByRole('textbox', { name: 'Mobile number' }, LAZY_SCREEN)).toBeDefined();
    expect(router.state.location.search).toEqual({ next: '/kyc' });
  });

  it('says someone is signed in when opened over a live session, and lets the next person start afresh', async () => {
    signIn();
    const router = renderAt('/sign-in?next=/rewards');
    // Nothing answers at the client's address, so the member's name is not known: it says someone.
    expect(await screen.findByText('Someone is signed in on this device.', {}, LAZY_SCREEN)).toBeDefined();
    expect(screen.queryByRole('textbox', { name: 'Mobile number' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('textbox', { name: 'Mobile number' }, LAZY_SCREEN)).toBeDefined();
    // The next person lands on Tonight, not where the last one's link pointed.
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('next'));
  });

  it('never shows the form while it is still reading whether someone is signed in', async () => {
    // An expired session with nothing answering: Auth keeps trying to refresh it.
    signIn({ expired: true });
    renderAt('/sign-in');
    expect(await screen.findByText('Checking who is signed in on this device.', {}, LAZY_SCREEN)).toBeDefined();
    expect(screen.queryByRole('textbox', { name: 'Mobile number' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeDefined();
  });

  it('names the member signed in, and continues to the screen the link pointed at', async () => {
    signIn();
    const router = renderAt('/sign-in?next=/rewards', clientWithKabir());
    expect(await screen.findByText('Kabir Sethi is signed in on this device.', {}, LAZY_SCREEN)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Continue as Kabir Sethi' }));
    await screen.findByRole('navigation', { name: 'Main' }, LAZY_SCREEN);
    expect(router.state.location.pathname).toBe('/rewards');
  });

  it('opens on its own with the lockup and the motto, once, and no tab bar', async () => {
    renderAt('/sign-in');
    expect(await screen.findByRole('img', { name: 'RIVR Poker Club' }, LAZY_SCREEN)).toBeDefined();
    expect(screen.getAllByText('Skill runs deep.')).toHaveLength(1);
    expect(screen.getByRole('textbox', { name: 'Mobile number' })).toBeDefined();
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
  });

  it('asks for a ten-digit mobile number before sending anything', async () => {
    renderAt('/sign-in');
    fireEvent.change(await screen.findByRole('textbox', { name: 'Mobile number' }), { target: { value: '12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByText('Enter a 10-digit mobile number.')).toBeDefined();
  });

  it('says sign-in is not available when Auth cannot be reached', async () => {
    renderAt('/sign-in');
    fireEvent.change(await screen.findByRole('textbox', { name: 'Mobile number' }), { target: { value: '98765 43210' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByText('Sign-in is not available right now. Try again in a few minutes.', {}, { timeout: 3000 })).toBeDefined();
  });
});

describe('sign-up', () => {
  // Nothing answers at the client's address, so this also signs out with Auth out of reach.
  it('lets a number that signed in by mistake sign out and start again', async () => {
    signIn();
    renderAt('/sign-up');
    fireEvent.click(await screen.findByRole('button', { name: 'Use another number' }, LAZY_SCREEN));
    expect(await screen.findByRole('textbox', { name: 'Mobile number' }, LAZY_SCREEN)).toBeDefined();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });
});

import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { Text } from '@rivr/ui';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KycStartScreen } from './KycStartScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/**
 * Identity opened by someone signed in, against an API whose member read answers `member`, their check `record`, whether
 * the club checks identity at the desk `atTheClub`, and an empty list to all else.
 */
function renderIdentity(member: unknown, { record = null, atTheClub = false }: { record?: unknown; atTheClub?: boolean } = {}) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000800', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-11-03T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rest/v1/member')) return Response.json(member);
    if (url.includes('/rpc/kyc_at_the_club')) return Response.json(atTheClub);
    return Response.json(url.includes('/rest/v1/kyc_record') ? record : []);
  });
  const rootRoute = createRootRoute();
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      createRoute({ getParentRoute: () => rootRoute, path: '/kyc', component: KycStartScreen }),
      createRoute({ getParentRoute: () => rootRoute, path: '/sign-up', component: () => <Text>Sign-up screen</Text> }),
    ]),
    history: createMemoryHistory({ initialEntries: ['/kyc'] }),
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}>
      <RouterProvider router={router} />
    </RivrDataProvider>,
  );
  return router;
}

describe('Identity › Start', () => {
  // Only a member has an identity check: the kyc function refuses anyone else's selfie (403).
  it('sends a number that is not a member yet to join first, to come back here once joined', async () => {
    const router = renderIdentity(null);
    expect(await screen.findByText('Sign-up screen')).toBeDefined();
    expect(router.state.location.pathname).toBe('/sign-up');
    expect(router.state.location.search).toEqual({ next: '/kyc' });
  });

  it('offers a member the selfie, the first step', async () => {
    const router = renderIdentity({ id: 'm1', full_name: 'Kabir Sethi' });
    expect(await screen.findByRole('button', { name: 'Take a selfie' })).toBeDefined();
    expect(screen.getByText('DigiLocker')).toBeDefined();
    expect(router.state.location.pathname).toBe('/kyc');
  });
});

describe('Identity › At the club (decision 0502)', () => {
  const STARTED = { status: 'started', photo_path: null, date_of_birth: null, masked_aadhaar: null, pan: null };

  it('asks only for a selfie while the club checks identity at the desk, naming the desk as the next step', async () => {
    renderIdentity({ id: 'm1', full_name: 'Kabir Sethi' }, { atTheClub: true });
    expect(await screen.findByRole('button', { name: 'Take a selfie' })).toBeDefined();
    expect(screen.getByText('At the club')).toBeDefined();
    expect(screen.getByText('Aadhaar and PAN at the desk, on your first visit')).toBeDefined();
    expect(screen.queryByText('DigiLocker')).toBeNull();
  });

  it('tells a member let in by their selfie they are registered, and what to bring', async () => {
    renderIdentity({ id: 'm1', full_name: 'Kabir Sethi' }, { atTheClub: true, record: { ...STARTED, at_club_from: '2026-11-05T09:00:00Z' } });
    expect(await screen.findByRole('heading', { name: "You're registered." })).toBeDefined();
    expect(screen.getByText('Bring your Aadhaar and PAN on your first visit. The desk checks them before you play.')).toBeDefined();
    expect(screen.getByRole('button', { name: "See tonight's tables" })).toBeDefined();
  });

  it('offers the app\'s own check again once the switch is off, even to a member let in by their selfie', async () => {
    renderIdentity({ id: 'm1', full_name: 'Kabir Sethi' }, { record: { ...STARTED, at_club_from: '2026-11-05T09:00:00Z' } });
    expect(await screen.findByRole('button', { name: 'Take a selfie' })).toBeDefined();
    expect(screen.getByText('DigiLocker')).toBeDefined();
  });
});

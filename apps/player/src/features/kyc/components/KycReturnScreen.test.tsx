import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { Text } from '@rivr/ui';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KycReturnScreen } from './KycReturnScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** Back from DigiLocker, signed in, against an API whose check reads `record`, whose kyc function answers `pull`, and whose switch is `atTheClub`. */
function renderReturn(record: unknown, pull: { status: number; body: unknown }, atTheClub = false) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000800', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-11-03T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/functions/v1/kyc')) return Response.json(pull.body, { status: pull.status });
    if (url.includes('/rpc/kyc_at_the_club')) return Response.json(atTheClub);
    if (url.includes('/rest/v1/kyc_record')) return Response.json(record);
    if (url.includes('/rest/v1/member')) return Response.json({ id: 'm1', full_name: 'Kabir Sethi' });
    return Response.json([]);
  });
  const rootRoute = createRootRoute();
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      createRoute({ getParentRoute: () => rootRoute, path: '/kyc/return', component: KycReturnScreen }),
      createRoute({ getParentRoute: () => rootRoute, path: '/kyc', component: () => <Text>Identity start</Text> }),
    ]),
    history: createMemoryHistory({ initialEntries: ['/kyc/return'] }),
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}>
      <RouterProvider router={router} />
    </RivrDataProvider>,
  );
}

const RECORD = { photo_path: 'v1/m1/photo.jpg', date_of_birth: '1990-01-01', masked_aadhaar: 'XXXX XXXX 1234', pan: 'ABCPS1234K', at_club_from: null };

describe('Identity › Back from DigiLocker', () => {
  it('shows a verified member where they stand when the back button brings them here again (audit F-155)', async () => {
    // Nothing is left to complete, so the kyc function answers 409: no outage.
    renderReturn({ ...RECORD, status: 'verified' }, { status: 409, body: { error: 'conflict' } });
    expect(await screen.findByRole('heading', { name: 'Verified' })).toBeDefined();
    expect(screen.queryByText('ID checks are down. Try again shortly.')).toBeNull();
  });

  it('sends a member held for a PAN check to the desk\'s selfie while the club checks identity (audit F-010)', async () => {
    renderReturn({ ...RECORD, status: 'needs_pan' }, { status: 409, body: { error: 'conflict' } }, true);
    expect(await screen.findByText('Identity start')).toBeDefined();
    expect(screen.queryByRole('textbox', { name: 'PAN' })).toBeNull();
  });

  it('keeps the PAN check with the switch off', async () => {
    renderReturn({ ...RECORD, status: 'needs_pan' }, { status: 409, body: { error: 'conflict' } });
    expect(await screen.findByRole('textbox', { name: 'PAN' })).toBeDefined();
  });

  it('says checks are down, with Try again, when the pull fails on a check still to complete', async () => {
    renderReturn({ ...RECORD, status: 'started' }, { status: 503, body: { error: 'unavailable' } });
    expect(await screen.findByText('ID checks are down. Try again shortly.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined();
  });
});

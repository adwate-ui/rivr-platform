import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { onlineManager, QueryClient } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAppRouter } from './router.tsx';

const USER = '00000000-0000-4000-8000-000000000202';

beforeEach(() => {
  // A returning phone that has made its cookie choice, signed in, with no connection.
  localStorage.setItem('rivr.cookies', JSON.stringify({ maps: false, analytics: false }));
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: USER, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
  onlineManager.setOnline(false);
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  onlineManager.setOnline(true);
  Reflect.deleteProperty(navigator, 'onLine');
});

/** Opens the app at Home with what the phone kept already in the cache. */
function openHome(kept: readonly (readonly [string, unknown])[]) {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  for (const [part, data] of kept) cache.setQueryData(['user', USER, part], data);
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })} queryClient={cache}>
      <RouterProvider router={createAppRouter(createMemoryHistory({ initialEntries: ['/'] }))} />
    </RivrDataProvider>,
  );
}

const LATER = { timeout: 5000 };

describe('the player app opened with no connection (F-053)', () => {
  it('says so with nothing kept, never an endless Identity', async () => {
    openHome([]);
    expect(await screen.findByRole('heading', { name: 'No connection' }, LATER)).toBeDefined();
    expect(screen.getByText('Open RIVR again once you are online.')).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Identity' })).toBeNull();
  });

  it('lets a kept check through to Home, which says so when it has no tables to show', async () => {
    openHome([['kyc-record', { status: 'verified', hasSelfie: true, photoPath: null, dateOfBirth: null, maskedAadhaar: null, pan: null, isAtTheClub: false }]]);
    expect(await screen.findByText('No connection. What you see may be out of date.', {}, LATER)).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'No connection' })).toBeNull();
  });
});

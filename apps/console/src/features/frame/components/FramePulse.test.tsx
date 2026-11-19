import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, StaffVenueProvider } from '@rivr/db';
import { ShortcutProvider, ToastProvider } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FramePulse } from './FrameHeader.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** The header's counts for floor staff, with no one seated or waiting, and these queues. */
function pulse(counts: Readonly<Record<string, number>>) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async () => Response.json([]));
  const root = createRootRoute();
  const screenRoute = createRoute({ getParentRoute: () => root, path: '/', component: () => (
    <FramePulse venueId="v1" permissions={['members.read', 'waitlist.manage']} counts={counts} />
  ) });
  const router = createRouter({ routeTree: root.addChildren([screenRoute]), history: createMemoryHistory({ initialEntries: ['/'] }) });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StaffVenueProvider>
        <ShortcutProvider><ToastProvider place="console"><RouterProvider router={router} /></ToastProvider></ShortcutProvider>
      </StaffVenueProvider>
    </RivrDataProvider>,
  );
  return screen.findByRole('navigation', { name: 'Tonight' });
}

describe('FramePulse', () => {
  it('counts one request as one, and more as requests', async () => {
    expect((await pulse({ callTimeSet: 1 })).textContent).toMatch(/1 request(?!s)/);
    cleanup();
    expect((await pulse({ callTimeSet: 2, topUps: 1 })).textContent).toContain('3 requests');
  });
});

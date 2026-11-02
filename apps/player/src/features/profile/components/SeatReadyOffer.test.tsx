import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SeatReadyOffer } from './SeatReadyOffer.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

/**
 * A member signed in on a phone with push, not subscribed yet, whose permission ask is kept in `asked`; their tier's
 * seat calls by push as `seatReady`, and seat calls off in their choices when `isOff`.
 */
function renderOffer(seatReady: 'enabled' | 'locked', isOff = false) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000211', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const asked: string[] = [];
  vi.stubGlobal('PushManager', class {});
  vi.stubGlobal('Notification', { permission: 'default', requestPermission: async () => { asked.push('asked'); return 'denied'; } });
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve({ pushManager: { getSubscription: async () => null } }) } });
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/my_feature_access')) return Response.json([{ feature_key: 'push.seat_ready', state: seatReady, tiers: seatReady === 'locked' ? ['Black card'] : null }]);
    if (url.includes('/rest/v1/notification_preference')) return Response.json(isOff ? [{ push_type: 'push.seat_ready', is_on: false }] : []);
    if (url.includes('/rest/v1/member_preference')) return Response.json(null);
    return Response.json([]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SeatReadyOffer />
    </RivrDataProvider>,
  );
  return asked;
}

describe('SeatReadyOffer', () => {
  it('offers seat-ready push to a tier that sends it, and asks this phone (F3-26)', async () => {
    const asked = renderOffer('enabled');
    fireEvent.click(await screen.findByRole('button', { name: 'Turn on seat calls on this phone' }, { timeout: 5000 }));
    await vi.waitFor(() => expect(asked).toEqual(['asked']));
  });

  it('remembers Not now on this phone', async () => {
    renderOffer('enabled');
    fireEvent.click(await screen.findByRole('button', { name: 'Not now' }, { timeout: 5000 }));
    expect(screen.queryByRole('button', { name: 'Tell me when my seat is ready' })).toBeNull();
    cleanup();
    renderOffer('enabled');
    await new Promise((settle) => setTimeout(settle, 200));
    expect(screen.queryByRole('button', { name: 'Tell me when my seat is ready' })).toBeNull();
  });

  it('offers nothing to a tier without seat calls by push, or to a member who turned seat calls off', async () => {
    renderOffer('locked');
    await new Promise((settle) => setTimeout(settle, 200));
    expect(screen.queryByRole('button', { name: 'Tell me when my seat is ready' })).toBeNull();
    cleanup();
    renderOffer('enabled', true);
    await new Promise((settle) => setTimeout(settle, 200));
    expect(screen.queryByRole('button', { name: 'Tell me when my seat is ready' })).toBeNull();
  });
});

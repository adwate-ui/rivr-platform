import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModeScreen } from './ModeScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** The lobby TV signed in, and a fake API whose screen read answers once, then fails, as in a network drop. */
function renderTv(drop: 'answers 503' | 'unreachable' = 'answers 503') {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-0000000000e1', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  let asked = 0;
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.includes('/rpc/my_tv_screen')) return Response.json([]);
    asked += 1;
    if (asked > 1 && drop === 'unreachable') throw new TypeError('Failed to fetch');
    if (asked > 1) return Response.json({ message: 'unreachable' }, { status: 503 });
    return Response.json([{ device_id: 'd1', venue_id: 'v1', name: 'Lobby TV', mode: 'waitlist', rotation: [] }]);
  });
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })} queryClient={cache}>
      <ModeScreen />
    </RivrDataProvider>,
  );
}

describe('a TV whose reads fail', () => {
  it('keeps its board and says quietly since when, with nothing to press', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderTv();
    expect(await screen.findByText('Waitlist')).toBeDefined();
    expect(screen.queryByText(/^Not updated since /)).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(await screen.findByText(/^Not updated since \d{2}:\d{2}\. Check the connection\.$/)).toBeDefined();
    expect(screen.getByText('Waitlist')).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('says so too when the TV itself loses its connection, and the line goes once a read comes through', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderTv('unreachable');
    expect(await screen.findByText('Waitlist')).toBeDefined();
    try {
      window.dispatchEvent(new Event('offline'));
      await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
      expect(await screen.findByText(/^Not updated since /)).toBeDefined();
    } finally {
      window.dispatchEvent(new Event('online'));
    }
  });
});

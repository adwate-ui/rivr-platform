import 'fake-indexeddb/auto';
import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { Text } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Frame } from './Frame.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'onLine');
});

const TABLE = { device_id: 'd1', venue_id: 'v1', name: 'Tablet A', kind: 'dealer_tablet', table_id: 't3', table_name: 'Table 3', is_practice: false };
const LATER = { timeout: 5000 };

/** A signed-in device whose `my_device` answers with `device`, or never while it is undefined. */
function renderFrame(device?: object) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-00000000e001', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/my_device')) return device === undefined ? new Promise<Response>(() => undefined) : Response.json([device]);
    return Response.json([]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Frame unpaired={<Text>Pair me</Text>} signIn={<Text>Sign in</Text>}><Text>Seats</Text></Frame>
    </RivrDataProvider>,
  );
}

const goOffline = () => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });

describe('the tablet frame', () => {
  it('names itself RIVR until it knows what it is (F-144)', async () => {
    renderFrame();
    expect((await screen.findAllByText('RIVR', {}, LATER)).length).toBeGreaterThan(0);
    expect(screen.queryByText('Dealer tablet')).toBeNull();
  });

  it('offline at a table, says the seats will catch up, and no count of nothing (F-045)', async () => {
    goOffline();
    renderFrame(TABLE);
    expect(await screen.findByText('Offline. Seats update when the network is back.', {}, LATER)).toBeDefined();
    expect(screen.queryByText(/0 hands/)).toBeNull();
  });

  it('offline before it knows what it is, says only that', () => {
    goOffline();
    renderFrame();
    expect(screen.getByText('Offline.')).toBeDefined();
  });
});

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
const DOOR = { ...TABLE, name: 'Door night-90', kind: 'door', table_id: null, table_name: null };
const LATER = { timeout: 5000 };

/** A signed-in device whose `my_device` answers with `device`, or never while it is undefined. */
function renderFrame(device?: object, isFrozen = false) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-00000000e001', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (isFrozen && url.includes('/rest/v1/control_state')) return Response.json([{ venue_id: 'v1', level: 'venue_freeze', feature: null, member_id: null, released_at: null }]);
    if (url.includes('/rpc/my_device')) return device === undefined ? new Promise<Response>(() => undefined) : Response.json([device]);
    return Response.json([]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Frame unpaired={<Text>Pair me</Text>} signIn={<Text>Sign in</Text>} door={<Text>Scanner</Text>}><Text>Seats</Text></Frame>
    </RivrDataProvider>,
  );
}

const goOffline = () => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });

describe('the tablet frame', () => {
  it('names itself RIVR until it knows what it is, as a member may be reading it at the door (F-144)', async () => {
    renderFrame();
    expect((await screen.findAllByText('RIVR', {}, LATER)).length).toBeGreaterThan(0);
    expect(screen.queryByText('Dealer tablet')).toBeNull();
  });

  it('offline at the door, says check-in is down, and no count of hands (F-045)', async () => {
    goOffline();
    renderFrame(DOOR);
    await screen.findByText('Scanner', {}, LATER);
    expect(screen.getByText('Check-in is offline. See the front desk.')).toBeDefined();
    expect(screen.queryByText(/hands queued/)).toBeNull();
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

  it('heads a door kiosk RIVR, not the name staff gave it (F-145)', async () => {
    renderFrame(DOOR);
    await screen.findByText('Scanner', {}, LATER);
    expect(screen.getByText('RIVR')).toBeDefined();
    expect(screen.queryByText('Door night-90')).toBeNull();
  });

  it('tells a member at a frozen door that the club is paused, and staff at a table that changes are refused', async () => {
    renderFrame(DOOR, true);
    expect(await screen.findByText('The club is paused. Ask a member of staff.', {}, LATER)).toBeDefined();
    cleanup();
    renderFrame(TABLE, true);
    expect(await screen.findByText('Venue frozen. Changes are refused until it is released.', {}, LATER)).toBeDefined();
  });
});

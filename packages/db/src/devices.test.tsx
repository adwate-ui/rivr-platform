import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useDealerTablets, useDeviceActions, useMyDevice, usePairDevice } from './devices.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const SIGNED_IN = '00000000-0000-4000-8000-000000000103';
const VENUE = '00000000-0000-4000-8000-000000000001';

/** A fake API: each path answers with its reply. */
function renderDevices(replies: Record<string, { status?: number; body: unknown }>) {
  const calls: { url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const path = Object.keys(replies).find((key) => url.includes(key));
    const reply = path ? replies[path] : undefined;
    return Response.json(reply?.body ?? null, { status: reply?.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(SIGNED_IN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(
    () => ({ mine: useMyDevice(), tablets: useDealerTablets(VENUE), pair: usePairDevice(), staff: useDeviceActions(VENUE) }),
    { wrapper },
  );
  return { result, calls };
}

const EMPTY = { '/rpc/my_device': { body: [] }, '/rest/v1/device': { body: [] }, '/rest/v1/tablet_assignment': { body: [] } };

afterEach(cleanup);

describe('Dealer tablets', () => {
  it('gives the signed-in tablet and its table, and nothing for anyone who is not a device', async () => {
    const paired = renderDevices({
      ...EMPTY,
      '/rpc/my_device': { body: [{ device_id: 'd1', venue_id: VENUE, name: 'Tablet A', kind: 'dealer_tablet', table_id: 't3', table_name: 'Table 3' }] },
    });
    await waitFor(() => expect(paired.result.current.mine.data).toEqual({ deviceId: 'd1', venueId: VENUE, name: 'Tablet A', tableId: 't3', tableName: 'Table 3' }));
    cleanup();
    const staff = renderDevices(EMPTY);
    await waitFor(() => expect(staff.result.current.mine.data).toBeNull());
  });

  it('lists the venue\'s tablets with whether each is paired and the table it is fixed to', async () => {
    const { result } = renderDevices({
      ...EMPTY,
      '/rest/v1/device': { body: [{ id: 'd1', name: 'Tablet A', auth_user_id: 'u1' }, { id: 'd2', name: 'Tablet B', auth_user_id: null }] },
      '/rest/v1/tablet_assignment': { body: [{ device_id: 'd1', table_id: 't3' }] },
    });
    await waitFor(() => expect(result.current.tablets.data).toEqual([
      { deviceId: 'd1', name: 'Tablet A', isPaired: true, tableId: 't3' },
      { deviceId: 'd2', name: 'Tablet B', isPaired: false, tableId: null },
    ]));
  });

  it('says a pairing code is wrong, and anything else is unavailable', async () => {
    const wrong = renderDevices({ ...EMPTY, '/functions/v1/device-pair': { status: 400, body: { error: 'wrong_code' } } });
    let outcome: unknown;
    await act(async () => { outcome = await wrong.result.current.pair.mutateAsync('123456'); });
    expect(outcome).toEqual({ ok: false, error: 'wrong_code' });
    expect(wrong.calls.find((call) => call.url.includes('device-pair'))?.body).toEqual({ code: '123456' });
    cleanup();
    const down = renderDevices({ ...EMPTY, '/functions/v1/device-pair': { status: 502, body: { error: 'unavailable' } } });
    await act(async () => { outcome = await down.result.current.pair.mutateAsync('123456'); });
    expect(outcome).toEqual({ ok: false, error: 'unavailable' });
  });

  it('adds a tablet and gives the code to read out to it', async () => {
    const { result, calls } = renderDevices({
      ...EMPTY,
      '/rest/v1/device': { body: { id: 'd9' } },
      '/rpc/start_device_pairing': { body: [{ code: '048213', expires_at: '2026-10-19T21:45:00+05:30' }] },
    });
    let outcome: unknown;
    await act(async () => { outcome = await result.current.staff.add.mutateAsync({ name: ' Tablet C ', staffId: 's1' }); });
    expect(outcome).toEqual({ ok: true, value: { deviceId: 'd9', code: '048213', expiresAt: '2026-10-19T21:45:00+05:30' } });
    expect(calls.find((call) => call.url.includes('/rest/v1/device'))?.body)
      .toEqual({ venue_id: VENUE, kind: 'dealer_tablet', name: 'Tablet C', enrolled_by_staff_id: 's1' });
  });

  it('says when the role does not allow it', async () => {
    const { result } = renderDevices({ ...EMPTY, '/rpc/assign_tablet': { status: 403, body: { code: '42501', message: 'no' } } });
    let outcome: unknown;
    await act(async () => { outcome = await result.current.staff.assign.mutateAsync({ deviceId: 'd1', tableId: 't3' }); });
    expect(outcome).toEqual({ ok: false, error: 'not_allowed' });
  });
});

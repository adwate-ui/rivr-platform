import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useCameras, useSaveCamera } from './cctv.ts';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const ADITYA = '00000000-0000-4000-8000-000000000103';
const VENUE = '00000000-0000-4000-8000-000000000001';

type Replies = Readonly<Record<string, { status: number; body: unknown }>>;

/** A fake API answering each path in `replies`, recording each request. */
function clientFor(replies: Replies) {
  const requests: { url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    requests.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const reply = Object.entries(replies).find(([path]) => url.includes(path))?.[1] ?? { status: 404, body: {} };
    return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'content-type': 'application/json' } });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(ADITYA), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  return { wrapper, requests };
}

afterEach(cleanup);

describe('useCameras', () => {
  it('reads the venue\'s cameras with what each watches', async () => {
    const { wrapper } = clientFor({ '/rpc/cameras': { status: 200, body: [
      { camera_id: 'c1', name: 'Table 2 overhead', channel: 'ch-2', table_id: 't2', table_name: 'Table 2', is_cage: false, is_active: true },
    ] } });
    const { result } = renderHook(() => useCameras(VENUE), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([
      { cameraId: 'c1', name: 'Table 2 overhead', channel: 'ch-2', tableId: 't2', tableName: 'Table 2', isCage: false, isActive: true },
    ]));
  });
});

describe('useSaveCamera', () => {
  it('adds a camera, sending only the ids it has', async () => {
    const { wrapper, requests } = clientFor({ '/rpc/save_camera': { status: 200, body: 'c9' }, '/rpc/cameras': { status: 200, body: [] } });
    const { result } = renderHook(() => useSaveCamera(VENUE), { wrapper });
    let saved: unknown;
    await act(async () => {
      saved = await result.current.mutateAsync({ cameraId: null, name: 'Cage', channel: 'ch-9', tableId: null, isCage: true, isActive: true });
    });
    expect(saved).toEqual({ ok: true, value: 'c9' });
    expect(requests.find((request) => request.url.includes('/rpc/save_camera'))?.body)
      .toEqual({ p_venue_id: VENUE, p_name: 'Cage', p_channel: 'ch-9', p_is_cage: true, p_is_active: true });
  });

  it('names why a camera was not saved', async () => {
    const { wrapper } = clientFor({ '/rpc/save_camera': { status: 409, body: { code: '23505', message: 'taken' } } });
    const { result } = renderHook(() => useSaveCamera(VENUE), { wrapper });
    let saved: unknown;
    await act(async () => {
      saved = await result.current.mutateAsync({ cameraId: 'c1', name: 'Cage', channel: 'ch-9', tableId: null, isCage: true, isActive: true });
    });
    expect(saved).toEqual({ ok: false, error: 'taken' });
  });
});

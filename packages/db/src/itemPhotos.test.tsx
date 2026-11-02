import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { itemPhotoUrl, useItemPhotoUpload } from './itemPhotos.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const ADITYA = '00000000-0000-4000-8000-000000000103';
const UPLOADS = '/storage/v1/object/item-photos/';

/** A photo the browser reads, made a JPEG of `bytes` bytes, as InPersonSection's test fakes a camera's. */
function photoOf(bytes: number) {
  vi.stubGlobal('createImageBitmap', async () => ({ width: 1200, height: 1600, close: () => undefined }));
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((done) => done(new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' })));
}

/** A fake API: Storage answers an upload with `upload`, the database set_item_photo with `rpc`; the addresses it was sent to and what. */
function renderUpload(upload = 200, rpc: { status: number; body: unknown } = { status: 204, body: null }) {
  const calls: { url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, body: typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body });
    if (url.includes(UPLOADS)) return Response.json({ Key: url.split('/object/')[1] }, { status: upload });
    if (url.includes('/rpc/set_item_photo')) return rpc.status === 204 ? new Response(null, { status: 204 }) : Response.json(rpc.body, { status: rpc.status });
    return Response.json([]);
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(ADITYA), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => useItemPhotoUpload('v1'), { wrapper });
  return { result, calls, client };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('item photos (AS-11)', () => {
  it('puts a reward\'s photo up under a name of its own, then makes it the reward\'s photo', async () => {
    photoOf(2000);
    const { result, calls } = renderUpload();
    expect(await act(() => result.current.mutateAsync({ kind: 'reward', itemId: 'r1', photo: new Blob(['raw']) }))).toEqual({ ok: true, value: null });
    const path = calls.find((call) => call.url.includes(UPLOADS))?.url.split(UPLOADS)[1];
    expect(path).toMatch(/^v1\/reward-[0-9a-f-]{36}\.jpg$/);
    expect(calls.find((call) => call.url.includes('/rpc/set_item_photo'))?.body).toEqual({ p_kind: 'reward', p_item_id: 'r1', p_path: path });
  });

  it('turns away a file that is not a photo, and one still over 1 MB once made small, sending nothing', async () => {
    vi.stubGlobal('createImageBitmap', async () => { throw new Error('Not an image'); });
    const notPhoto = renderUpload();
    expect(await act(() => notPhoto.result.current.mutateAsync({ kind: 'menu', itemId: 'chai', photo: new Blob(['text']) })))
      .toEqual({ ok: false, error: 'not_a_photo' });
    photoOf(1_048_577);
    const tooBig = renderUpload();
    expect(await act(() => tooBig.result.current.mutateAsync({ kind: 'menu', itemId: 'chai', photo: new Blob(['raw']) })))
      .toEqual({ ok: false, error: 'too_big' });
    expect([...notPhoto.calls, ...tooBig.calls].filter((call) => call.url.includes(UPLOADS))).toEqual([]);
  });

  it('says when the role may not set a photo, and when the photo did not go up', async () => {
    photoOf(2000);
    const refused = renderUpload(200, { status: 403, body: { code: '42501', message: 'Only staff who keep the menu', details: null, hint: null } });
    expect(await act(() => refused.result.current.mutateAsync({ kind: 'menu', itemId: 'chai', photo: new Blob(['raw']) })))
      .toEqual({ ok: false, error: 'not_allowed' });
    const lost = renderUpload(400);
    expect(await act(() => lost.result.current.mutateAsync({ kind: 'menu', itemId: 'chai', photo: new Blob(['raw']) })))
      .toEqual({ ok: false, error: 'unavailable' });
    expect(lost.calls.some((call) => call.url.includes('/rpc/set_item_photo'))).toBe(false);
  });

  it('gives a photo\'s public address, or null when the item has none', () => {
    const { client } = renderUpload();
    expect(itemPhotoUrl(client, 'v1/menu-chai.jpg')).toBe('http://127.0.0.1:9/storage/v1/object/public/item-photos/v1/menu-chai.jpg');
    expect(itemPhotoUrl(client, null)).toBeNull();
  });
});

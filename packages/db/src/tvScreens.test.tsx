import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider, useAuthStatus } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';
import { useIsPublicVenue, useMyTvScreen, useTvActions, useTvPairing, useVenueTvs } from './tvScreens.ts';

const STAFF = '00000000-0000-4000-8000-000000000103';
const VENUE = '00000000-0000-4000-8000-000000000001';
const SECRET = 'a'.repeat(64);
const CODE = { code: '048213', secret: SECRET, expires_at: '2099-10-19T21:45:00+05:30' };

type Reply = { status?: number; body: unknown };

/** Which reply answers a call: the TV's two asks of device-pair by their body, anything else by its path. */
function replyKey(url: string, body: unknown, paths: readonly string[]): string | undefined {
  const tv = typeof body === 'object' && body !== null ? Reflect.get(body, 'tv') : undefined;
  return typeof tv === 'string' ? `device-pair:${tv}` : paths.find((path) => url.includes(path));
}

/**
 * A fake API, signed in as `userId` or signed out: each path answers with its reply. The TV's two
 * asks of device-pair are told apart by their body, as `device-pair:start` and `device-pair:check`.
 */
function renderTvs(userId: string | null, replies: Record<string, Reply>) {
  const calls: { url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    const body: unknown = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, body });
    const key = replyKey(url, body, Object.keys(replies));
    const reply = key === undefined ? undefined : replies[key];
    return Response.json(reply?.body ?? null, { status: reply?.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(userId), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  return { client, calls, wrapper };
}

const asks = (calls: { body: unknown }[], tv: string) =>
  calls.filter((call) => typeof call.body === 'object' && call.body !== null && Reflect.get(call.body, 'tv') === tv);

afterEach(cleanup);

describe('An unpaired TV', () => {
  it('shows a code, and asks with its secret whether it was typed in', async () => {
    const { calls, wrapper } = renderTvs(null, { 'device-pair:start': { body: CODE }, 'device-pair:check': { body: { waiting: true } } });
    const { result } = renderHook(() => useTvPairing(), { wrapper });
    await waitFor(() => expect(result.current).toEqual({ status: 'code', code: { code: '048213', secret: SECRET, expiresAt: CODE.expires_at } }));
    await waitFor(() => expect(asks(calls, 'check')[0]?.body).toEqual({ tv: 'check', secret: SECRET }));
    expect(asks(calls, 'start')).toHaveLength(1);
  });

  it('signs in as itself with the session it is handed once its code is typed in', async () => {
    const part = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    const token = `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ sub: 'tv-login', aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.c2ln`;
    const { calls, wrapper } = renderTvs(null, {
      'device-pair:start': { body: CODE },
      'device-pair:check': { body: { access_token: token, refresh_token: 'tv-refresh' } },
      '/auth/v1/user': { body: { id: 'tv-login', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-19T00:00:00Z' } },
      '/rpc/my_tv_screen': { body: [] },
    });
    const { result } = renderHook(() => ({ pairing: useTvPairing(), auth: useAuthStatus() }), { wrapper });
    await waitFor(() => expect(result.current.auth).toBe('signed-in'));
    expect(asks(calls, 'check')).toHaveLength(1);
  });

  it('asks for a new code once its secret is no longer good', async () => {
    const { calls, wrapper } = renderTvs(null, { 'device-pair:start': { body: CODE }, 'device-pair:check': { status: 400, body: { error: 'expired' } } });
    renderHook(() => useTvPairing(), { wrapper });
    await waitFor(() => expect(asks(calls, 'start').length).toBeGreaterThan(1));
  });

  it('says when too many screens asked, and when RIVR cannot be reached', async () => {
    const busy = renderTvs(null, { 'device-pair:start': { status: 429, body: { error: 'too_many' } } });
    const refused = renderHook(() => useTvPairing(), { wrapper: busy.wrapper });
    await waitFor(() => expect(refused.result.current).toEqual({ status: 'too_many' }));
    cleanup();
    const closed = renderTvs(null, { 'device-pair:start': { status: 403, body: { error: 'window_closed' } } });
    const waiting = renderHook(() => useTvPairing(), { wrapper: closed.wrapper });
    await waitFor(() => expect(waiting.result.current).toEqual({ status: 'window_closed' }));
    cleanup();
    const down = renderTvs(null, { 'device-pair:start': { status: 502, body: { error: 'unavailable' } } });
    const failed = renderHook(() => useTvPairing(), { wrapper: down.wrapper });
    await waitFor(() => expect(failed.result.current).toEqual({ status: 'unavailable' }));
    expect(asks(down.calls, 'check')).toHaveLength(0);
  });

  it('asks for no code while someone is signed in', async () => {
    const { calls, wrapper } = renderTvs(STAFF, { '/rpc/my_tv_screen': { body: [] } });
    const { result } = renderHook(() => useTvPairing(), { wrapper });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current).toEqual({ status: 'loading' });
    expect(asks(calls, 'start')).toHaveLength(0);
  });
});

describe('A paired TV', () => {
  it('reads its name, mode and the boards it turns to in between', async () => {
    const { wrapper } = renderTvs('tv-login', {
      '/rpc/my_tv_screen': { body: [{ device_id: 'd1', venue_id: VENUE, name: 'Bar TV', mode: 'waitlist', rotation: ['promotions'] }] },
    });
    const { result } = renderHook(() => useMyTvScreen(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual({ deviceId: 'd1', venueId: VENUE, name: 'Bar TV', mode: 'waitlist', rotation: ['promotions'] }));
  });

  it('signs itself out once it reads nothing, so it shows a new code', async () => {
    const { calls, wrapper } = renderTvs('tv-login', { '/rpc/my_tv_screen': { body: [] } });
    const { result } = renderHook(() => ({ screen: useMyTvScreen(), auth: useAuthStatus() }), { wrapper });
    await waitFor(() => expect(result.current.auth).toBe('signed-out'));
    expect(calls.some((call) => call.url.includes('/auth/v1/logout'))).toBe(true);
  });

  it('knows whether its venue is public, so the stream overlay never shows the practice venue', async () => {
    const club = renderTvs('tv-login', { '/rest/v1/public_venue': { body: [{ id: VENUE }] } });
    const atClub = renderHook(() => useIsPublicVenue(VENUE), { wrapper: club.wrapper });
    expect(atClub.result.current).toBeUndefined();
    await waitFor(() => expect(atClub.result.current).toBe(true));
    expect(club.calls.find((call) => call.url.includes('/rest/v1/public_venue'))?.url).toContain(`id=eq.${VENUE}`);
    cleanup();
    const practice = renderTvs('tv-login', { '/rest/v1/public_venue': { body: [] } });
    const atPractice = renderHook(() => useIsPublicVenue(VENUE), { wrapper: practice.wrapper });
    await waitFor(() => expect(atPractice.result.current).toBe(false));
  });
});

describe('The console\'s TVs', () => {
  it('lists the venue\'s TVs with whether each is paired and what it shows', async () => {
    const { wrapper } = renderTvs(STAFF, {
      '/rest/v1/device': { body: [{ id: 'd1', name: 'Bar TV', auth_user_id: 'u1' }, { id: 'd2', name: 'Door TV', auth_user_id: null }] },
      '/rest/v1/tv_screen': { body: [{ device_id: 'd1', mode: 'jackpot', rotation: ['call_time', 'promotions'] }] },
    });
    const { result } = renderHook(() => useVenueTvs(VENUE), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([
      { deviceId: 'd1', name: 'Bar TV', isPaired: true, mode: 'jackpot', rotation: ['call_time', 'promotions'] },
      { deviceId: 'd2', name: 'Door TV', isPaired: false, mode: null, rotation: [] },
    ]));
  });

  it('pairs a TV by its code, and says when no TV shows that code', async () => {
    const paired = renderTvs(STAFF, { '/rpc/claim_tv_pairing': { body: 'd9' } });
    const actions = renderHook(() => useTvActions(VENUE), { wrapper: paired.wrapper });
    let outcome: unknown;
    await act(async () => { outcome = await actions.result.current.pair.mutateAsync({ code: '048213', name: ' Bar TV ', mode: 'waitlist' }); });
    expect(outcome).toEqual({ ok: true, value: 'd9' });
    expect(paired.calls.find((call) => call.url.includes('claim_tv_pairing'))?.body).toEqual({ p_venue_id: VENUE, p_code: '048213', p_name: 'Bar TV', p_mode: 'waitlist' });
    cleanup();
    const wrong = renderTvs(STAFF, { '/rpc/claim_tv_pairing': { status: 400, body: { code: 'RVCOD', message: 'No TV is showing that code' } } });
    const refused = renderHook(() => useTvActions(VENUE), { wrapper: wrong.wrapper });
    await act(async () => { outcome = await refused.result.current.pair.mutateAsync({ code: '048214', name: 'Bar TV', mode: 'waitlist' }); });
    expect(outcome).toEqual({ ok: false, error: 'wrong_code' });
  });

  it('changes what a TV shows, and unpairs one with the reason', async () => {
    const { calls, wrapper } = renderTvs(STAFF, {
      '/rpc/set_tv_mode': { status: 403, body: { code: '42501', message: 'no' } },
      '/rpc/set_tv_rotation': { status: 400, body: { code: '22023', message: 'no' } },
      '/rest/v1/device': { body: null },
    });
    const { result } = renderHook(() => useTvActions(VENUE), { wrapper });
    let outcome: unknown;
    await act(async () => { outcome = await result.current.setMode.mutateAsync({ deviceId: 'd1', mode: 'jackpot' }); });
    expect(outcome).toEqual({ ok: false, error: 'not_allowed' });
    await act(async () => { outcome = await result.current.setRotation.mutateAsync({ deviceId: 'd1', rotation: ['jackpot', 'jackpot'] }); });
    expect(outcome).toEqual({ ok: false, error: 'invalid' });
    expect(calls.find((call) => call.url.includes('/rpc/set_tv_rotation'))?.body).toEqual({ p_device_id: 'd1', p_rotation: ['jackpot', 'jackpot'] });
    await act(async () => { outcome = await result.current.unpair.mutateAsync({ deviceId: 'd1', reason: ' Moved ' }); });
    expect(outcome).toEqual({ ok: true, value: null });
    expect(calls.find((call) => call.url.includes('/rest/v1/device'))?.body).toEqual({ revoked_at: 'now', revoked_reason: 'Moved' });
  });
});

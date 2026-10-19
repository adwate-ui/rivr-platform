import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useCurrentDown, useDownActions, useSetDealerPin, useVenueDealers } from './dealerDowns.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const SIGNED_IN = '00000000-0000-4000-8000-000000000101';
const VENUE = '00000000-0000-4000-8000-000000000001';

/** A fake API: each path answers with its reply. */
function renderDowns(replies: Record<string, { status?: number; body: unknown }>) {
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
    () => ({ dealers: useVenueDealers(VENUE), setPin: useSetDealerPin(VENUE), down: useCurrentDown('t3'), actions: useDownActions() }),
    { wrapper },
  );
  return { result, calls };
}

const EMPTY = { '/rpc/venue_dealers': { body: [] }, '/rpc/current_down': { body: [] } };

afterEach(cleanup);

describe('Dealer PINs and downs', () => {
  it('lists the dealers whose PIN the manager may set, and the down at the tablet\'s table', async () => {
    const { result } = renderDowns({
      '/rpc/venue_dealers': { body: [{ staff_id: 's1', full_name: 'Pema Lepcha', has_pin: true, locked_until: null }] },
      '/rpc/current_down': { body: [{ down_id: 'd1', staff_id: 's1', full_name: 'Pema Lepcha', started_at: '2026-10-19T21:05:00+05:30' }] },
    });
    await waitFor(() => expect(result.current.dealers.data).toEqual([{ staffId: 's1', fullName: 'Pema Lepcha', hasPin: true, lockedUntil: null }]));
    await waitFor(() => expect(result.current.down.data).toEqual({ downId: 'd1', staffId: 's1', fullName: 'Pema Lepcha', startedAt: '2026-10-19T21:05:00+05:30' }));
  });

  it('says why a PIN was not set', async () => {
    const { result } = renderDowns({ ...EMPTY, '/rpc/set_dealer_pin': { status: 400, body: { code: '22023', message: 'pin' } } });
    let outcome: unknown;
    await act(async () => { outcome = await result.current.setPin.mutateAsync({ staffId: 's1', pin: '1111' }); });
    expect(outcome).toEqual({ ok: false, error: 'invalid' });
  });

  it('says a PIN is wrong with the tries left, or locked, or that the venue is frozen', async () => {
    const wrong = renderDowns({ ...EMPTY, '/rpc/dealer_sign_in': { body: [{ down_id: null, refusal: 'wrong_pin', tries_left: 3 }] } });
    let outcome: unknown;
    await act(async () => { outcome = await wrong.result.current.actions.signIn.mutateAsync({ staffId: 's1', pin: '0000' }); });
    expect(outcome).toEqual({ ok: false, error: { reason: 'wrong_pin', triesLeft: 3 } });
    cleanup();
    const locked = renderDowns({ ...EMPTY, '/rpc/dealer_sign_in': { body: [{ down_id: null, refusal: 'locked', tries_left: 0 }] } });
    await act(async () => { outcome = await locked.result.current.actions.signIn.mutateAsync({ staffId: 's1', pin: '0000' }); });
    expect(outcome).toEqual({ ok: false, error: { reason: 'locked' } });
    cleanup();
    const frozen = renderDowns({ ...EMPTY, '/rpc/dealer_sign_in': { status: 400, body: { code: 'RVFRZ', message: 'venue_frozen' } } });
    await act(async () => { outcome = await frozen.result.current.actions.signIn.mutateAsync({ staffId: 's1', pin: '2741' }); });
    expect(outcome).toEqual({ ok: false, error: { reason: 'paused' } });
  });

  it('starts the down with the right PIN', async () => {
    const { result, calls } = renderDowns({ ...EMPTY, '/rpc/dealer_sign_in': { body: [{ down_id: 'd2', refusal: null, tries_left: null }] } });
    let outcome: unknown;
    await act(async () => { outcome = await result.current.actions.signIn.mutateAsync({ staffId: 's1', pin: '2741' }); });
    expect(outcome).toEqual({ ok: true, value: null });
    expect(calls.find((call) => call.url.includes('dealer_sign_in'))?.body).toEqual({ p_staff_id: 's1', p_pin: '2741' });
  });
});

import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { usePreferenceActions, usePreferences } from './preferences.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const KABIR = '00000000-0000-4000-8000-000000000202';

/** A fake API: each table answers with its rows, each function with 204. */
function renderPreferences(tables: Record<string, unknown>) {
  const calls: { url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (url.includes('/rest/v1/rpc/has_my_consent')) return Response.json(tables.has_my_consent ?? false);
    if (url.includes('/rest/v1/rpc/')) return new Response(null, { status: 204 });
    const table = Object.keys(tables).find((name) => url.includes(`/rest/v1/${name}?`));
    return Response.json(table ? tables[table] : null);
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(KABIR), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({ preferences: usePreferences(), actions: usePreferenceActions() }), { wrapper });
  return { result, calls };
}

afterEach(cleanup);

describe('usePreferences', () => {
  it('gives the member their games, stake, notifications turned off and marketing consent', async () => {
    const { result } = renderPreferences({
      member_preference: { games: ['tournaments', 'nlh'], small_blind: 10000, big_blind: 20000 },
      notification_preference: [{ push_type: 'push.seat_ready', is_on: false }, { push_type: 'push.withdrawal_sent', is_on: true }],
      has_my_consent: true,
    });

    await waitFor(() =>
      expect(result.current.preferences.data).toEqual({
        games: ['nlh', 'tournaments'],
        stake: { smallBlind: 10000n, bigBlind: 20000n },
        notificationsOff: ['push.seat_ready'],
        marketing: true,
      }),
    );
  });

  it('starts with every notification on, no games, any stake and no marketing', async () => {
    const { result } = renderPreferences({ member_preference: null, notification_preference: [], has_my_consent: false });

    await waitFor(() =>
      expect(result.current.preferences.data).toEqual({ games: [], stake: null, notificationsOff: [], marketing: false }),
    );
  });
});

describe('usePreferenceActions', () => {
  it('saves games with the stake as it is', async () => {
    const { result, calls } = renderPreferences({});

    const saved = await act(() =>
      result.current.actions.saveGames.mutateAsync({ games: ['plo'], stake: { smallBlind: 5000n, bigBlind: 10000n } }),
    );

    expect(saved).toEqual({ ok: true, value: null });
    expect(calls.find((call) => call.url.includes('/rpc/save_my_preferences'))?.body).toEqual({
      p_games: ['plo'], p_small_blind: 5000, p_big_blind: 10000,
    });
  });

  it('turns a notification off, and gives or withdraws the marketing consent', async () => {
    const { result, calls } = renderPreferences({});

    await act(() => result.current.actions.setNotification.mutateAsync({ type: 'push.seat_ready', isOn: false }));
    await act(() => result.current.actions.setMarketing.mutateAsync(true));
    await act(() => result.current.actions.setMarketing.mutateAsync(false));

    const rpcs = calls.filter((call) => call.url.includes('/rpc/') && !call.url.includes('/rpc/has_my_consent')).map((call) => [call.url.split('/rpc/')[1], call.body]);
    expect(rpcs).toEqual([
      ['set_my_notification', { p_push_type: 'push.seat_ready', p_is_on: false }],
      ['give_consent', { p_purpose: 'marketing' }],
      ['withdraw_consent', { p_purpose: 'marketing' }],
    ]);
  });
});

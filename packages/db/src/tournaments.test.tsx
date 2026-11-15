import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';
import { toVenueTournament, useTournamentActions } from './tournaments.ts';

const SIGNED_IN = '00000000-0000-4000-8000-000000000103';
const VENUE = '00000000-0000-4000-8000-000000000001';

/** A fake API that answers every function call with `reply`, the tournament actions, and the calls sent. */
function renderActions(reply: { status?: number; body: unknown }) {
  const calls: { name: string | undefined; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!url.includes('/rpc/') || url.includes('/rpc/venue_tournaments')) return Response.json([]);
    calls.push({ name: url.split('/rpc/')[1]?.split('?')[0], body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return Response.json(reply.body, { status: reply.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(SIGNED_IN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => useTournamentActions(VENUE), { wrapper });
  return { result, calls };
}

const NEW = { name: ' Diwali Deepstack ', startsAt: new Date('2026-11-15T10:30:00Z'), game: 'No-limit hold’em' };

afterEach(cleanup);

describe('creating a tournament', () => {
  it('sends its name, start and game, and no money', async () => {
    const { result, calls } = renderActions({ body: 't1' });
    let created: unknown;
    await act(async () => { created = await result.current.create.mutateAsync(NEW); });
    expect(created).toEqual({ ok: true, value: 't1' });
    expect(calls).toEqual([{
      name: 'publish_tournament',
      body: { p_venue_id: VENUE, p_name: 'Diwali Deepstack', p_starts_at: '2026-11-15T10:30:00.000Z', p_game: 'No-limit hold’em' },
    }]);
  });

  it('says why it was not created', async () => {
    for (const [code, failure] of [['22023', 'invalid'], ['42501', 'not_allowed'], ['RVFRZ', 'paused'], ['XX000', 'unavailable']]) {
      const { result } = renderActions({ status: 400, body: { code, message: 'no' } });
      let created: unknown;
      await act(async () => { created = await result.current.create.mutateAsync(NEW); });
      expect(created).toEqual({ ok: false, error: failure });
    }
  });
});

describe('the notification, cancelling and entries', () => {
  it('sends the notification and gives how many were told', async () => {
    const { result, calls } = renderActions({ body: 2 });
    let sent: unknown;
    await act(async () => { sent = await result.current.notify.mutateAsync('t1'); });
    expect(sent).toEqual({ ok: true, value: 2 });
    expect(calls).toEqual([{ name: 'notify_tournament', body: { p_tournament_id: 't1' } }]);
  });

  it('says when nobody could be told, and when members were told too often', async () => {
    for (const [code, failure] of [['RVNOB', 'nobody'], ['RVRAT', 'too_often'], ['22023', 'invalid']]) {
      const { result } = renderActions({ status: 400, body: { code, message: 'no' } });
      let sent: unknown;
      await act(async () => { sent = await result.current.notify.mutateAsync('t1'); });
      expect(sent).toEqual({ ok: false, error: failure });
    }
  });

  it('cancels one to come, and types a started one’s entries', async () => {
    const { result, calls } = renderActions({ body: null });
    await act(async () => { await result.current.cancel.mutateAsync('t1'); });
    let typed: unknown;
    await act(async () => { typed = await result.current.setEntries.mutateAsync({ tournamentId: 't2', entries: 58 }); });
    expect(typed).toEqual({ ok: true, value: null });
    expect(calls).toEqual([
      { name: 'withdraw_tournament', body: { p_tournament_id: 't1' } },
      { name: 'set_tournament_entries', body: { p_tournament_id: 't2', p_entries: 58 } },
    ]);
  });
});

describe('toVenueTournament', () => {
  const ROW = {
    tournament_id: 't1', name: 'RIVR Sunday', starts_at: '2026-11-15T10:30:00+00:00', game: 'No-limit hold’em', is_past: false, interested: 61,
    notified_at: null, notified: null, entries: null,
  };

  it('reads one to come, not yet notified', () => {
    expect(toVenueTournament(ROW)).toEqual({
      tournamentId: 't1', name: 'RIVR Sunday', startsAt: '2026-11-15T10:30:00+00:00', game: 'No-limit hold’em', isPast: false, interested: 61,
      notifiedAt: null, notified: null, entries: null,
    });
  });

  it('reads a past one with its notification and entries, and one made before a game was asked for', () => {
    const past = toVenueTournament({ ...ROW, game: null, is_past: true, notified_at: '2026-11-14T06:30:00+00:00', notified: 58, entries: 61 });
    expect(past).toMatchObject({ game: '', isPast: true, notifiedAt: '2026-11-14T06:30:00+00:00', notified: 58, entries: 61 });
  });
});

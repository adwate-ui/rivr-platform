import { fromPaise } from '@rivr/domain/money';
import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useLiveTournament, useTvTournamentClock } from './liveTournament.ts';
import { RivrDataProvider } from './provider.tsx';
import { useBlindStructures, useTournamentSetupActions, useTournamentTemplates } from './tournamentSetup.ts';
import { useTournamentActions, useTournamentClock, useVenueTournaments } from './tournaments.ts';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const SIGNED_IN = '00000000-0000-4000-8000-000000000103';
const VENUE = '00000000-0000-4000-8000-000000000001';
const LEVELS = [{ kind: 'level', small_blind: 400, big_blind: 800, ante: 800, minutes: 20 }, { kind: 'break', minutes: 10 }];

/** A fake API: each path answers with its reply; every call is kept with what it sent. */
function renderHooks(replies: Record<string, { status?: number; body: unknown }>) {
  const calls: { url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const path = Object.keys(replies).find((key) => url.includes(key));
    const reply = path ? replies[path] : undefined;
    return Response.json(reply?.body ?? [], { status: reply?.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(SIGNED_IN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({
    tournaments: useVenueTournaments(VENUE), clock: useTournamentClock(VENUE), actions: useTournamentActions(VENUE),
    structures: useBlindStructures(VENUE), templates: useTournamentTemplates(VENUE), setup: useTournamentSetupActions(VENUE),
    live: useLiveTournament(), tv: useTvTournamentClock(),
  }), { wrapper });
  return { result, calls };
}

const bodyOf = (calls: { url: string; body: unknown }[], path: string) => calls.find((call) => call.url.includes(path))?.body;

const TOURNAMENT = {
  id: 't1', name: 'RIVR Sunday', starts_at: '2026-11-15T10:30:00+00:00', is_published: true, format: 're_entry', buy_in_paise: 1000000,
  fee_paise: 100000, guarantee_paise: 50000000, starting_stack: 30000, levels: LEVELS, last_registration_level: 9, max_buys: null,
  add_on_paise: null, add_on_fee_paise: null, add_on_chips: null, places_paid: 8, clock_started_at: '2026-11-15T10:30:00+00:00',
  is_paused: false, elapsed_seconds: 8300,
};

afterEach(cleanup);

describe('the console’s tournaments (decision 0201)', () => {
  it('reads each tournament with its levels and its clock as read', async () => {
    const { result } = renderHooks({ '/rpc/venue_tournaments': { body: [TOURNAMENT, { ...TOURNAMENT, id: 't2', levels: null, clock_started_at: null }] } });
    await waitFor(() => expect(result.current.tournaments.data).toHaveLength(2));
    expect(result.current.tournaments.data?.[0]).toMatchObject({
      format: 're_entry', buyIn: 1000000n, fee: 100000n, guarantee: 50000000n, addOn: null, placesPaid: 8,
      stages: [{ kind: 'level', smallBlind: 400, bigBlind: 800, ante: 800, minutes: 20 }, { kind: 'break', minutes: 10 }],
      clock: { elapsedSeconds: 8300, isRunning: true },
    });
    expect(result.current.tournaments.data?.[1]).toMatchObject({ stages: [], clock: null });
  });

  it('starts, pauses and moves the clock through its own function each', async () => {
    const { result, calls } = renderHooks({});
    await act(async () => {
      await result.current.clock.mutateAsync({ tournamentId: 't1', change: 'start' });
      await result.current.clock.mutateAsync({ tournamentId: 't1', change: 'pause' });
      await result.current.clock.mutateAsync({ tournamentId: 't1', change: 'previous' });
    });
    expect(bodyOf(calls, '/rpc/start_tournament_clock')).toEqual({ p_tournament_id: 't1' });
    expect(bodyOf(calls, '/rpc/pause_tournament_clock')).toEqual({ p_tournament_id: 't1', p_is_paused: true });
    expect(bodyOf(calls, '/rpc/move_tournament_level')).toEqual({ p_tournament_id: 't1', p_step: -1 });
  });

  it('says why a change was refused', async () => {
    const { result } = renderHooks({ '/rpc/move_tournament_level': { status: 400, body: { code: '22023', message: 'There is no stage after the last' } } });
    let outcome: unknown;
    await act(async () => { outcome = await result.current.clock.mutateAsync({ tournamentId: 't1', change: 'next' }); });
    expect(outcome).toEqual({ ok: false, error: 'invalid' });
  });

  it('makes a tournament from a template at its start', async () => {
    const { result, calls } = renderHooks({ '/rpc/create_tournament': { body: 't3' } });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.actions.create.mutateAsync({ templateId: 'p1', name: ' Sunday ', startsAt: new Date('2026-11-22T10:30:00Z'), isPublished: true });
    });
    expect(outcome).toEqual({ ok: true, value: 't3' });
    expect(bodyOf(calls, '/rpc/create_tournament')).toEqual({ p_template_id: 'p1', p_name: 'Sunday', p_starts_at: '2026-11-22T10:30:00.000Z', p_is_published: true });
  });
});

describe('templates and blind structures (decision 0200)', () => {
  it('reads structures and templates, amounts in paise', async () => {
    const { result } = renderHooks({
      '/blind_structure': { body: [{ id: 's1', name: 'Deep', levels: LEVELS }] },
      '/tournament_template': {
        body: [{ id: 'p1', venue_id: VENUE, name: 'Rebuy', format: 'rebuy', buy_in_paise: 200000, fee_paise: 20000, starting_stack: 10000,
          blind_structure_id: 's1', last_registration_level: 6, max_buys: 4, add_on_paise: 200000, add_on_fee_paise: 0, add_on_chips: 15000,
          places_paid: 5, guarantee_paise: null }],
      },
    });
    await waitFor(() => expect(result.current.structures.data?.[0]?.stages).toHaveLength(2));
    await waitFor(() => expect(result.current.templates.data?.[0]).toMatchObject({
      format: 'rebuy', buyIn: 200000n, maxBuys: 4, addOn: { price: 200000n, fee: 0n, chips: 15000 }, guarantee: null,
    }));
  });

  it('saves a structure as the database keeps levels, and a template with its columns', async () => {
    const { result, calls } = renderHooks({ '/rpc/save_blind_structure': { body: 's2' }, '/rpc/save_tournament_template': { body: 'p2' } });
    await act(async () => {
      await result.current.setup.saveStructure.mutateAsync({ structureId: null, name: 'Short', stages: [{ kind: 'level', smallBlind: 50, bigBlind: 100, ante: 0, minutes: 15 }] });
      await result.current.setup.saveTemplate.mutateAsync({
        templateId: 'p1', name: 'Turbo', format: 'freezeout', buyIn: fromPaise(300000n), fee: fromPaise(30000n), startingStack: 15000, structureId: 's1',
        lastRegistrationLevel: 4, maxBuys: null, addOn: null, placesPaid: 3, guarantee: null,
      });
    });
    expect(bodyOf(calls, '/rpc/save_blind_structure')).toEqual({
      p_venue_id: VENUE, p_name: 'Short', p_levels: [{ kind: 'level', small_blind: 50, big_blind: 100, ante: 0, minutes: 15 }],
    });
    expect(bodyOf(calls, '/rpc/save_tournament_template')).toMatchObject({
      p_template_id: 'p1', p_template: { name: 'Turbo', format: 'freezeout', buy_in_paise: 300000, fee_paise: 30000, add_on_paise: null, guarantee_paise: null },
    });
  });
});

describe('the running tournament on Home and the TV (decision 0201)', () => {
  it('reads it with its clock, or nothing when none runs', async () => {
    const { result } = renderHooks({
      '/rpc/live_tournament': { body: [{ name: 'RIVR Sunday', levels: LEVELS, elapsed_seconds: 600, is_paused: true }] },
      '/rpc/tv_tournament_clock': { body: [] },
    });
    await waitFor(() => expect(result.current.live.data).toMatchObject({ name: 'RIVR Sunday', clock: { elapsedSeconds: 600, isRunning: false } }));
    await waitFor(() => expect(result.current.tv.data).toBeNull());
  });
});

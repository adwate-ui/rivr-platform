import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useLeagueSeasons, useSaveLeagueSeason, useVenueLeague } from './league.ts';
import { RivrDataProvider } from './provider.tsx';
import { useHandOverRedemption, useRewardItems, useSaveRewardItem, useVenueRedemptions } from './rewards.ts';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const SIGNED_IN = '00000000-0000-4000-8000-000000000107';
const VENUE = '00000000-0000-4000-8000-000000000001';

/** A fake API: each path answers with its reply; every call is kept with what it sent. */
function renderHooks(replies: Record<string, { status?: number; body: unknown }>) {
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
  const { result } = renderHook(() => ({
    items: useRewardItems(VENUE), save: useSaveRewardItem(VENUE), redemptions: useVenueRedemptions(VENUE), handOver: useHandOverRedemption(VENUE),
    seasons: useLeagueSeasons(VENUE), saveSeason: useSaveLeagueSeason(VENUE), league: useVenueLeague(VENUE, '2026-11', '2027-01'),
  }), { wrapper });
  return { result, calls };
}

const bodyOf = (calls: { url: string; body: unknown }[], path: string) => calls.find((call) => call.url.includes(path))?.body;

afterEach(cleanup);

describe('the rewards catalogue (decision 0181)', () => {
  it('reads the catalogue and redemptions, points as whole numbers', async () => {
    const { result } = renderHooks({
      '/reward_item': { body: [{ id: 'r1', kind: 'merchandise', name: 'RIVR cap', detail: 'At the host desk', points: 4000, stock: null, is_live: true }] },
      '/rpc/venue_redemptions': {
        body: [{
          id: 'd1', member_id: 'm1', full_name: 'Mihir Shah', member_number: 1213, reward_name: 'RIVR cap', kind: 'merchandise', points: 4000,
          created_at: '2026-11-15T17:00:00Z', handed_over_at: null, handed_over_by: null,
        }],
      },
    });
    await waitFor(() => expect(result.current.items.data).toEqual([
      { id: 'r1', kind: 'merchandise', name: 'RIVR cap', detail: 'At the host desk', points: 4000n, stock: null, isLive: true },
    ]));
    await waitFor(() => expect(result.current.redemptions.data?.[0]).toMatchObject({ fullName: 'Mihir Shah', points: 4000n, handedOverAt: null }));
  });

  it('saves a new reward with no limit, leaving the id and stock out', async () => {
    const { result, calls } = renderHooks({ '/rpc/save_reward_item': { body: 'r2' } });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.save.mutateAsync({
        itemId: null, kind: 'fnb_upgrade', name: ' F&B upgrade ', detail: 'At the bar', points: 2500, stock: null, stockWas: null, isLive: true,
      });
    });
    expect(outcome).toEqual({ ok: true, value: 'r2' });
    expect(bodyOf(calls, '/rpc/save_reward_item')).toEqual({
      p_venue_id: VENUE, p_kind: 'fnb_upgrade', p_name: 'F&B upgrade', p_detail: 'At the bar', p_points: 2500, p_is_live: true,
    });
  });

  it('changes one, with its id and stock, and says why a hand-over failed', async () => {
    const { result, calls } = renderHooks({
      '/rpc/save_reward_item': { status: 400, body: { code: 'RVFRZ', message: 'frozen' } },
      '/rpc/hand_over_redemption': { status: 400, body: { code: 'RVHND', message: 'handed over' } },
    });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.save.mutateAsync({
        itemId: 'r1', kind: 'merchandise', name: 'RIVR cap', detail: 'At the host desk', points: 4000, stock: 3, stockWas: 2, isLive: false,
      });
    });
    expect(outcome).toEqual({ ok: false, error: 'paused' });
    expect(bodyOf(calls, '/rpc/save_reward_item')).toMatchObject({ p_item_id: 'r1', p_stock: 3, p_stock_was: 2, p_is_live: false });
    await act(async () => { outcome = await result.current.handOver.mutateAsync('d1'); });
    expect(outcome).toEqual({ ok: false, error: 'handed_over' });
    expect(bodyOf(calls, '/rpc/hand_over_redemption')).toEqual({ p_redemption_id: 'd1' });
  });
});

describe('the League (decision 0182)', () => {
  it('reads seasons and standings over months, and saves a season by its months', async () => {
    const { result, calls } = renderHooks({
      '/league_season': { body: [{ id: 's1', name: 'Season one', first_month: '2026-11-01', last_month: '2027-04-01' }] },
      '/rpc/venue_league': {
        body: [{ place: 1, member_id: 'm1', full_name: 'Mihir Shah', member_number: 1213, cash_points: 30, tournament_points: 105, points: 135 }],
      },
      '/rpc/save_league_season': { body: 's2' },
    });
    await waitFor(() => expect(result.current.seasons.data).toEqual([{ id: 's1', name: 'Season one', firstMonth: '2026-11-01', lastMonth: '2027-04-01' }]));
    await waitFor(() => expect(result.current.league.data?.[0]).toMatchObject({ place: 1, cashPoints: 30n, tournamentPoints: 105n, points: 135n }));
    expect(bodyOf(calls, '/rpc/venue_league')).toEqual({ p_venue_id: VENUE, p_first: '2026-11-01', p_last: '2027-01-01' });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.saveSeason.mutateAsync({ seasonId: null, name: ' Season two ', firstMonth: '2027-05', lastMonth: '2027-10' });
    });
    expect(outcome).toEqual({ ok: true, value: 's2' });
    expect(bodyOf(calls, '/rpc/save_league_season')).toEqual({
      p_venue_id: VENUE, p_name: 'Season two', p_first_month: '2027-05-01', p_last_month: '2027-10-01',
    });
  });
});

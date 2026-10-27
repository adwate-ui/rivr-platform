import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useMyLeague, useMyRedemptions, useMyRewards, useRedeemReward, useRewardCatalogue } from './myRewards.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';
import { useTvLeagueBoard, useTvRewardsTicker } from './rewards.ts';

const SIGNED_IN = '00000000-0000-4000-8000-0000000d0702';

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
    rewards: useMyRewards(), catalogue: useRewardCatalogue(), redemptions: useMyRedemptions(), redeem: useRedeemReward(), league: useMyLeague(),
    ticker: useTvRewardsTicker(), board: useTvLeagueBoard(),
  }), { wrapper });
  return { result, calls };
}

const BOARD_ROW = { standing: 'month', season_name: null, first_month: '2026-11-01', last_month: '2026-11-01', place: 1, display_name: 'Riya S.', points: 135 };

afterEach(cleanup);

describe('the member\'s Rewards', () => {
  it('reads points, tier and hotel nights, the catalogue, the redemptions and the League', async () => {
    const { result } = renderHooks({
      '/rpc/my_rewards': { body: [{ points: 20000, tier_name: 'Member', nights: 1250 }] },
      '/reward_item': { body: [{ id: 'r1', kind: 'fnb_upgrade', name: 'Bar upgrade', detail: 'At the bar', points: 2500, stock: null, is_live: true }] },
      '/rpc/my_redemptions': {
        body: [{ id: 'd1', reward_name: 'Bar upgrade', kind: 'fnb_upgrade', detail: 'At the bar', points: 2500, created_at: '2026-11-15T17:00:00Z', handed_over_at: null }],
      },
      '/rpc/my_league': { body: [{ ...BOARD_ROW, is_me: true }] },
      '/rpc/tv_rewards_ticker': { body: [] },
      '/rpc/tv_league_board': { body: [] },
    });
    await waitFor(() => expect(result.current.rewards.data).toEqual({ points: 20000n, tierName: 'Member', nights: 1250n }));
    await waitFor(() => expect(result.current.catalogue.data?.[0]).toMatchObject({ kind: 'fnb_upgrade', points: 2500n, stock: null }));
    await waitFor(() => expect(result.current.redemptions.data?.[0]).toMatchObject({ rewardName: 'Bar upgrade', points: 2500n, handedOverAt: null }));
    await waitFor(() => expect(result.current.league.data).toEqual([{
      standing: 'month', seasonName: null, firstMonth: '2026-11-01', lastMonth: '2026-11-01', place: 1, name: 'Riya S.', points: 135n, isMe: true,
    }]));
  });

  it('redeems at the price shown, once per request id, and says why not', async () => {
    const { result, calls } = renderHooks({ '/rpc/redeem_reward': { status: 400, body: { code: 'RVPRC', message: 'price changed' } } });
    let outcome: unknown;
    await act(async () => { outcome = await result.current.redeem.mutateAsync({ itemId: 'r1', points: 2500n, requestId: 'q1' }); });
    expect(outcome).toEqual({ ok: false, error: 'price_changed' });
    expect(calls.find((call) => call.url.includes('/rpc/redeem_reward'))?.body).toEqual({ p_item_id: 'r1', p_points: 2500, p_idempotency_key: 'q1' });
  });
});

describe('the TV\'s rewards boards', () => {
  it('splits the ticker into leaders and redemptions, and reads the League board', async () => {
    const { result } = renderHooks({
      '/rpc/tv_rewards_ticker': {
        body: [
          { kind: 'leader', place: 1, display_name: 'Riya S.', points: 30000, reward_name: null, at: null },
          { kind: 'redemption', place: null, display_name: null, points: 2500, reward_name: 'Bar upgrade', at: '2026-11-15T17:00:00Z' },
        ],
      },
      '/rpc/tv_league_board': { body: [BOARD_ROW] },
    });
    await waitFor(() => expect(result.current.ticker.data).toEqual({
      leaders: [{ place: 1, name: 'Riya S.', points: 30000n }],
      redemptions: [{ name: null, rewardName: 'Bar upgrade', at: '2026-11-15T17:00:00Z' }],
    }));
    await waitFor(() => expect(result.current.board.data?.[0]).toMatchObject({ name: 'Riya S.', isMe: false }));
  });
});

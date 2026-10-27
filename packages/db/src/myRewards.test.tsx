import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import {
  useMyCab, useMyCabRequests, useMyLeague, useMyRedemptions, useMyReferral, useMyRewards, useRedeemReward, useRequestCab, useRewardCatalogue,
} from './myRewards.ts';
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
    ticker: useTvRewardsTicker(), board: useTvLeagueBoard(), referral: useMyReferral(),
    cab: useMyCab(), cabRequests: useMyCabRequests(), requestCab: useRequestCab(),
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

  it('reads the referral code, how many were referred and the bonus each side gets now', async () => {
    const { result } = renderHooks({ '/rpc/my_referral': { body: [{ code: 'RIVR1042', referred: 2, bonus_paise: 100000 }] } });
    await waitFor(() => expect(result.current.referral.data).toEqual({ code: 'RIVR1042', referred: 2, bonus: 100000n }));
  });

  it('reads no bonus while the referral promotion is not running, and no code without referrals', async () => {
    const running = renderHooks({ '/rpc/my_referral': { body: [{ code: 'RIVR1042', referred: 0, bonus_paise: null }] } });
    await waitFor(() => expect(running.result.current.referral.data).toEqual({ code: 'RIVR1042', referred: 0, bonus: null }));
    cleanup();
    const without = renderHooks({ '/rpc/my_referral': { body: [] } });
    await waitFor(() => expect(without.result.current.referral.data).toBeNull());
  });

  it('redeems at the price shown, once per request id, and says why not', async () => {
    const { result, calls } = renderHooks({ '/rpc/redeem_reward': { status: 400, body: { code: 'RVPRC', message: 'price changed' } } });
    let outcome: unknown;
    await act(async () => { outcome = await result.current.redeem.mutateAsync({ itemId: 'r1', points: 2500n, nights: null, requestId: 'q1' }); });
    expect(outcome).toEqual({ ok: false, error: 'price_changed' });
    expect(calls.find((call) => call.url.includes('/rpc/redeem_reward'))?.body).toEqual({ p_item_id: 'r1', p_points: 2500, p_idempotency_key: 'q1' });
  });

  it('redeems a hotel night for the nights shown, and says when there are not enough', async () => {
    const { result, calls } = renderHooks({ '/rpc/redeem_reward': { status: 400, body: { code: 'RVNGT', message: 'not enough nights' } } });
    let outcome: unknown;
    await act(async () => { outcome = await result.current.redeem.mutateAsync({ itemId: 'r2', points: null, nights: 2, requestId: 'q2' }); });
    expect(outcome).toEqual({ ok: false, error: 'not_enough_nights' });
    expect(calls.find((call) => call.url.includes('/rpc/redeem_reward'))?.body).toEqual({ p_item_id: 'r2', p_nights: 2, p_idempotency_key: 'q2' });
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

describe('the member’s cab', () => {
  it('says whether a cab is offered, lists what was asked, and asks for one', async () => {
    const { result, calls } = renderHooks({
      '/rpc/my_cab': { body: [{ is_eligible: true, visits: 4, minimum_visits: 4 }] },
      '/rest/v1/cab_request': { body: [{ id: 'c1', kind: 'drop', address: 'DLF Phase 3', wanted_at: '2026-11-15T17:30:00+00:00' }] },
      '/rpc/request_cab': { body: 'c2' },
    });
    await waitFor(() => expect(result.current.cab.data).toEqual({ isEligible: true, visits: 4, minimumVisits: 4 }));
    await waitFor(() => expect(result.current.cabRequests.data).toEqual([
      { requestId: 'c1', kind: 'drop', address: 'DLF Phase 3', wantedAt: '2026-11-15T17:30:00+00:00' },
    ]));
    let asked: unknown;
    await act(async () => {
      asked = await result.current.requestCab.mutateAsync({ kind: 'pickup', address: 'Sector 54', time: '21:30' });
    });
    expect(asked).toEqual({ ok: true, value: 'c2' });
    expect(calls.find((call) => call.url.includes('/rpc/request_cab'))?.body).toEqual({ p_kind: 'pickup', p_address: 'Sector 54', p_time: '21:30' });
  });

  it('gives no cab to a tier without it, and says why a request was refused', async () => {
    const { result } = renderHooks({ '/rpc/my_cab': { body: [] }, '/rpc/request_cab': { status: 400, body: { code: 'RVCAB', message: 'visits' } } });
    await waitFor(() => expect(result.current.cab.data).toBeNull());
    let refused: unknown;
    await act(async () => {
      refused = await result.current.requestCab.mutateAsync({ kind: 'drop', address: 'DLF Phase 3', time: '23:00' });
    });
    expect(refused).toEqual({ ok: false, error: 'not_eligible' });
  });
});

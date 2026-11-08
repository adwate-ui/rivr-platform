import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { ToastProvider } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { RewardsScreen } from './RewardsScreen.tsx';

const FEATURES = ['rewards.catalogue', 'referral.share_cards', 'rewards.bonus', 'rewards.points_history'].map((feature_key) => ({ feature_key, state: 'enabled', tiers: null }));
/** Meera's bonus chips (decision 0504): 1,250 left after a 1,500 welcome and 1,000 used at Table 3, and more given before. */
export const BONUS_LINES = [
  { line_id: 'b2', at: '2026-11-15T18:00:00Z', kind: 'redeemed', amount_paise: 100_000, reason: null, table_name: 'Table 3' },
  { line_id: 'b1', at: '2026-11-14T18:00:00Z', kind: 'credited', amount_paise: 150_000, reason: 'Welcome bonus', table_name: null },
];
/** Meera's points, the newest first: spent on a cap, given locked, earned at a visit. */
const POINTS_LINES = [
  { line_id: 'p3', at: '2026-11-15T18:00:00Z', kind: 'spent', points: 500, reason: 'Redeemed: RIVR cap' },
  { line_id: 'p2', at: '2026-11-14T18:00:00Z', kind: 'locked', points: 700, reason: 'Founders pack' },
  { line_id: 'p1', at: '2026-11-13T18:00:00Z', kind: 'earned', points: 250, reason: 'Points for the visit' },
];
interface BonusReplies { balance: number | 'down'; lines: readonly unknown[]; isEarlierDown?: boolean }
const ITEMS = [
  { id: 'chai', kind: 'fnb_upgrade', name: 'Masala chai upgrade', detail: 'At the bar', points: 500, nights: null, stock: null, is_live: true, photo_path: null },
  { id: 'hoodie', kind: 'merchandise', name: 'RIVR hoodie', detail: 'At the host desk', points: 3000, nights: null, stock: 0, is_live: true, photo_path: null },
  { id: 'seat', kind: 'tournament_seat', name: 'Sunday Main Event seat', detail: 'Booked by the host', points: 4000, nights: null, stock: null, is_live: true, photo_path: null },
];
const REDEMPTION = {
  id: 'r0', reward_name: 'RIVR cap', kind: 'merchandise', detail: 'At the host desk', points: 800, nights: null, created_at: '2026-11-01T18:00:00Z', handed_over_at: null, cancelled_at: null, cancel_reason: null,
};

/** The bonus chips' replies (decision 0504): the history, kept as asked for, or the balance; undefined for any other path. */
function bonusReply(url: string, body: string, bonus: BonusReplies, historyAsked: unknown[]): Response | undefined {
  if (url.includes('/rpc/my_bonus_history')) {
    historyAsked.push(JSON.parse(body));
    return bonus.isEarlierDown === true && historyAsked.length > 1 ? Response.json({ code: 'XX000', message: 'down' }, { status: 500 }) : Response.json(bonus.lines);
  }
  if (!url.includes('/rpc/my_bonus')) return undefined;
  return bonus.balance === 'down' ? Response.json({ code: 'XX000', message: 'down' }, { status: 500 }) : Response.json([{ bonus_paise: bonus.balance }]);
}

/** Meera signed in with 3,250 points, bonus chips, the catalogue and Refer a friend; redeeming sends its order to `redeemed`. */
export function renderRewards(points = 3250, bonus: BonusReplies = { balance: 125_000, lines: BONUS_LINES }, more: { items?: readonly unknown[]; features?: readonly string[]; nights?: number; pointsHistory?: 'hidden' | 'locked'; pointsReply?: (asked: { p_limit: number }) => Response | Promise<Response> } = {}) {
  const historyAsked: unknown[] = [];
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000231', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const redeemed: unknown[] = [];
  // Each read's reply by its path; any other is nothing.
  const answers: Record<string, unknown> = {
    '/rpc/my_feature_access': [
      ...FEATURES.filter((feature) => more.pointsHistory === undefined || feature.feature_key !== 'rewards.points_history'),
      ...(more.pointsHistory === 'locked' ? [{ feature_key: 'rewards.points_history', state: 'locked', tiers: ['Black card'] }] : []),
      ...(more.features ?? []).map((feature_key) => ({ feature_key, state: 'enabled', tiers: null })),
    ],
    '/rpc/my_rewards': [{ points, tier_name: 'Founders’ Circle', nights: more.nights ?? 0 }], '/rpc/my_locked_points': 0,
    '/rpc/my_points_history': POINTS_LINES, '/rest/v1/reward_item': more.items ?? ITEMS, '/rpc/my_redemptions': [REDEMPTION], '/rpc/my_referral': [{ code: 'RIVR4821', referred: 2, bonus_paise: 100000 }],
  };
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const body = String(init?.body ?? '{}');
    const bonusAnswer = bonusReply(url, body, bonus, historyAsked);
    if (bonusAnswer !== undefined) return bonusAnswer;
    if (url.includes('/rpc/my_points_history') && more.pointsReply !== undefined) return more.pointsReply(JSON.parse(body));
    if (url.includes('/rpc/redeem_reward')) {
      redeemed.push(JSON.parse(body));
      return Response.json('r1');
    }
    const path = Object.keys(answers).find((key) => url.includes(key));
    return Response.json(path === undefined ? [] : answers[path]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider><RewardsScreen /></ToastProvider>
    </RivrDataProvider>,
  );
  return { redeemed, historyAsked };
}

export const LATER = { timeout: 5000 };

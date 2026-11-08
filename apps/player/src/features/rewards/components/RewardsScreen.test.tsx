import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { ToastProvider } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RewardsScreen } from './RewardsScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const FEATURES = ['rewards.catalogue', 'referral.share_cards', 'rewards.bonus', 'rewards.points_history'].map((feature_key) => ({ feature_key, state: 'enabled', tiers: null }));
/** Meera's bonus chips (decision 0504): 1,250 left after a 1,500 welcome and 1,000 used at Table 3, and more given before. */
const BONUS_LINES = [
  { line_id: 'b2', at: '2026-11-15T18:00:00Z', kind: 'redeemed', amount_paise: 100_000, reason: null, table_name: 'Table 3' },
  { line_id: 'b1', at: '2026-11-14T18:00:00Z', kind: 'credited', amount_paise: 150_000, reason: 'Welcome bonus', table_name: null },
];
/** Meera's points, the newest first: spent on a cap, given locked, earned at a visit. */
const POINTS_LINES = [
  { line_id: 'p3', at: '2026-11-15T18:00:00Z', kind: 'spent', points: 500, reason: 'Redeemed: RIVR cap' },
  { line_id: 'p2', at: '2026-11-14T18:00:00Z', kind: 'locked', points: 700, reason: 'Founders pack' },
  { line_id: 'p1', at: '2026-11-13T18:00:00Z', kind: 'earned', points: 250, reason: 'Points for the visit' },
];
interface BonusReplies { balance: number | 'down'; lines: readonly unknown[] }
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
    return Response.json(bonus.lines);
  }
  if (!url.includes('/rpc/my_bonus')) return undefined;
  return bonus.balance === 'down' ? Response.json({ code: 'XX000', message: 'down' }, { status: 500 }) : Response.json([{ bonus_paise: bonus.balance }]);
}

/** Meera signed in with 3,250 points, bonus chips, the catalogue and Refer a friend; redeeming sends its order to `redeemed`. */
function renderRewards(points = 3250, bonus: BonusReplies = { balance: 125_000, lines: BONUS_LINES }) {
  const historyAsked: unknown[] = [];
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000231', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const redeemed: unknown[] = [];
  // Each read's reply by its path; any other is nothing.
  const answers: Record<string, unknown> = {
    '/rpc/my_feature_access': FEATURES, '/rpc/my_rewards': [{ points, tier_name: 'Founders’ Circle', nights: 0 }], '/rpc/my_locked_points': 0,
    '/rpc/my_points_history': POINTS_LINES, '/rest/v1/reward_item': ITEMS, '/rpc/my_redemptions': [REDEMPTION], '/rpc/my_referral': [{ code: 'RIVR4821', referred: 2, bonus_paise: 100000 }],
  };
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const body = String(init?.body ?? '{}');
    const bonusAnswer = bonusReply(url, body, bonus, historyAsked);
    if (bonusAnswer !== undefined) return bonusAnswer;
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

const LATER = { timeout: 5000 };

describe('Rewards: points and bonus chips (decision 0504; owner, 8 Nov)', () => {
  it('shows points and bonus chips side by side, each with what it is for, the history closed until the chips tile opens it', async () => {
    const { historyAsked } = renderRewards();
    const chips = await screen.findByRole('button', { name: /Bonus chips/ }, LATER);
    expect(chips.textContent).toBe('1,250Bonus chipsUse with your buy-in. Never expire.History');
    expect(screen.getByText('Points')).toBeDefined();
    expect(screen.getByText('Spend on rewards.')).toBeDefined();
    expect(chips.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Buy-in · Table 3 · 15 Nov')).toBeNull();
    expect(historyAsked).toEqual([]);
    fireEvent.click(chips);
    expect(chips.getAttribute('aria-expanded')).toBe('true');
    expect(await screen.findByRole('heading', { name: 'Bonus chips history' }, LATER)).toBeDefined();
    expect(await screen.findByText('Buy-in · Table 3 · 15 Nov', {}, LATER)).toBeDefined();
    expect(screen.getByText('−1,000')).toBeDefined();
    expect(screen.getByText('Welcome bonus · 14 Nov')).toBeDefined();
    expect(screen.getByText('+1,500')).toBeDefined();
    expect(historyAsked).toEqual([{ p_limit: 20 }]);
    expect(screen.queryByRole('button', { name: 'Show earlier' })).toBeNull();
    expect(screen.queryByText(/₹/)).toBeNull();
  });

  it('opens the points history from its tile, each line signed, closed until the member opens it (F-054)', async () => {
    renderRewards();
    const points = await screen.findByRole('button', { name: /Spend on rewards/ }, LATER);
    expect(points.textContent).toContain('History');
    expect(screen.queryByText('Redeemed: RIVR cap · 15 Nov')).toBeNull();
    fireEvent.click(points);
    expect(points.getAttribute('aria-expanded')).toBe('true');
    expect(await screen.findByRole('heading', { name: 'Points history' }, LATER)).toBeDefined();
    expect(await screen.findByText('Redeemed: RIVR cap · 15 Nov', {}, LATER)).toBeDefined();
    expect(screen.getByText('−500')).toBeDefined();
    expect(screen.getByText('Locked · Founders pack · 14 Nov')).toBeDefined();
    expect(screen.getByText('Points for the visit · 13 Nov')).toBeDefined();
    expect(screen.getByText('+250')).toBeDefined();
  });

  it('offers earlier lines once twenty are shown', async () => {
    const lines = Array.from({ length: 20 }, (_, index) => ({ ...BONUS_LINES[1], line_id: `g${index}`, at: `2026-10-${String(index + 1).padStart(2, '0')}T18:00:00Z` }));
    const { historyAsked } = renderRewards(3250, { balance: 3_000_000, lines });
    fireEvent.click(await screen.findByRole('button', { name: /Bonus chips/ }, LATER));
    fireEvent.click(await screen.findByRole('button', { name: 'Show earlier' }, LATER));
    await waitFor(() => expect(historyAsked).toEqual([{ p_limit: 20 }, { p_limit: 40 }]));
  });

  it('shows no bonus chips as 0, and offers Try again when they cannot be read', async () => {
    renderRewards(3250, { balance: 0, lines: [] });
    const chips = await screen.findByRole('button', { name: /Bonus chips/ }, LATER);
    expect(chips.textContent).toContain('0Bonus chips');
    fireEvent.click(chips);
    expect(await screen.findByText('Nothing here yet.', {}, LATER)).toBeDefined();
    cleanup();
    renderRewards(3250, { balance: 'down', lines: [] });
    expect(await screen.findByText('3,250', {}, LATER)).toBeDefined();
    expect(await screen.findByRole('button', { name: 'Try again' }, LATER)).toBeDefined();
    expect(screen.queryByRole('button', { name: /Bonus chips/ })).toBeNull();
  });
});

describe('Rewards', () => {
  it('shows the tier, the points, and the next reward with how many points to go, and no rupee', async () => {
    renderRewards();
    expect(await screen.findByText('3,250', {}, LATER)).toBeDefined();
    expect(screen.getByText('Founders’ Circle')).toBeDefined();
    expect(await screen.findByText('Next: Sunday Main Event seat', {}, LATER)).toBeDefined();
    expect(screen.getAllByText('750 to go').length).toBeGreaterThan(0);
    expect(screen.queryByText(/₹/)).toBeNull();
  });

  it('filters the catalogue by its pills', async () => {
    renderRewards();
    expect(await screen.findByText('RIVR hoodie', {}, LATER)).toBeDefined();
    fireEvent.click(screen.getByRole('radio', { name: 'F&B upgrades' }));
    expect(screen.getByText('Masala chai upgrade')).toBeDefined();
    expect(screen.queryByText('RIVR hoodie')).toBeNull();
  });

  it('cannot redeem a reward out of reach or one with none left', async () => {
    renderRewards();
    // Named from what each shows first (WCAG 2.5.3).
    const seat = await screen.findByRole('button', { name: '750 to go, Sunday Main Event seat' }, LATER);
    expect(seat.hasAttribute('disabled')).toBe(true);
    expect(seat.textContent).toBe('750 to go');
    const hoodie = screen.getByRole('button', { name: 'None left, RIVR hoodie' });
    expect(hoodie.hasAttribute('disabled')).toBe(true);
    expect(hoodie.textContent).toBe('None left');
  });

  it('redeems from its sheet, with the cost and the balance after, then says so', async () => {
    const { redeemed } = renderRewards();
    fireEvent.click(await screen.findByRole('button', { name: 'Redeem Masala chai upgrade' }, LATER));
    const sheet = await screen.findByRole('dialog', { name: 'Masala chai upgrade' });
    expect(within(sheet).getByText('500 points')).toBeDefined();
    expect(within(sheet).getByText('2,750 points')).toBeDefined();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Redeem' }));
    expect(await screen.findByText('Redeemed')).toBeDefined();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(redeemed).toEqual([expect.objectContaining({ p_item_id: 'chai', p_points: 500, p_idempotency_key: expect.any(String) })]);
  });

  it('lists a redemption as Ready to collect until it is handed over', async () => {
    renderRewards();
    expect(await screen.findByText('RIVR cap', {}, LATER)).toBeDefined();
    expect(screen.getByText('Ready to collect')).toBeDefined();
  });

  it('copies the member’s invite link, with their code, and says so', async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { clipboard: { writeText } }));
    renderRewards();
    expect(await screen.findByText('RIVR4821', {}, LATER)).toBeDefined();
    expect(screen.getByText('2 joined')).toBeDefined();
    expect(screen.getByText('1,000 bonus chips each when a friend joins and takes their first seat.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(await screen.findByText('Invite link copied')).toBeDefined();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('RIVR4821'));
  });

  it('says Everything unlocked when every reward still to be had is within reach (one with none left is not next)', async () => {
    renderRewards(4500);
    expect(await screen.findByText('Everything unlocked', {}, LATER)).toBeDefined();
    expect(screen.queryByText(/ to go$/)).toBeNull();
  });
});

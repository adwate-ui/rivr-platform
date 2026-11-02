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

const FEATURES = ['rewards.catalogue', 'referral.share_cards'].map((feature_key) => ({ feature_key, state: 'enabled', tiers: null }));
const ITEMS = [
  { id: 'chai', kind: 'fnb_upgrade', name: 'Masala chai upgrade', detail: 'At the bar', points: 500, nights: null, stock: null, is_live: true, photo_path: null },
  { id: 'hoodie', kind: 'merchandise', name: 'RIVR hoodie', detail: 'At the host desk', points: 3000, nights: null, stock: 0, is_live: true, photo_path: null },
  { id: 'seat', kind: 'tournament_seat', name: 'Sunday Main Event seat', detail: 'Booked by the host', points: 4000, nights: null, stock: null, is_live: true, photo_path: null },
];
const REDEMPTION = {
  id: 'r0', reward_name: 'RIVR cap', kind: 'merchandise', detail: 'At the host desk', points: 800, nights: null, created_at: '2026-11-01T18:00:00Z', handed_over_at: null, cancelled_at: null, cancel_reason: null,
};

/** Meera signed in with 3,250 points, the catalogue and Refer a friend; redeeming sends its order to `redeemed`. */
function renderRewards(points = 3250) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000231', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const redeemed: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/my_feature_access')) return Response.json(FEATURES);
    if (url.includes('/rpc/my_rewards')) return Response.json([{ points, tier_name: 'Founders’ Circle', nights: 0 }]);
    if (url.includes('/rpc/my_locked_points')) return Response.json(0);
    if (url.includes('/rest/v1/reward_item')) return Response.json(ITEMS);
    if (url.includes('/rpc/my_redemptions')) return Response.json([REDEMPTION]);
    if (url.includes('/rpc/my_referral')) return Response.json([{ code: 'RIVR4821', referred: 2, bonus_paise: 100000 }]);
    if (url.includes('/rpc/redeem_reward')) {
      redeemed.push(JSON.parse(String(init?.body)));
      return Response.json('r1');
    }
    return Response.json([]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider><RewardsScreen /></ToastProvider>
    </RivrDataProvider>,
  );
  return { redeemed };
}

const LATER = { timeout: 5000 };

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
    fireEvent.click(screen.getByRole('button', { name: 'F&B upgrades' }));
    expect(screen.getByText('Masala chai upgrade')).toBeDefined();
    expect(screen.queryByText('RIVR hoodie')).toBeNull();
  });

  it('cannot redeem a reward out of reach or one with none left', async () => {
    renderRewards();
    const seat = await screen.findByRole('button', { name: 'Redeem Sunday Main Event seat' }, LATER);
    expect(seat.hasAttribute('disabled')).toBe(true);
    expect(seat.textContent).toBe('750 to go');
    const hoodie = screen.getByRole('button', { name: 'Redeem RIVR hoodie' });
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
    expect(screen.getByText('1,000 bonus chips each when a friend joins and buys in.')).toBeDefined();
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

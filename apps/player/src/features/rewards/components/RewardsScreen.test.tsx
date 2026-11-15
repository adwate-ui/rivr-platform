import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LATER, renderRewards } from './rewardsTestKit.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('Rewards: points', () => {
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

  it('wraps its filters, so none is off-screen (F-187)', async () => {
    renderRewards();
    const filters = await screen.findByRole('radiogroup', { name: 'Show' }, LATER);
    expect(filters.className).toContain('flex-wrap');
    expect(filters.className).not.toContain('overflow-x-auto');
  });

  it('lists a reward with none left after the rest (F-187)', async () => {
    renderRewards();
    const hoodie = await screen.findByText('RIVR hoodie', {}, LATER);
    const seat = screen.getByText('Sunday Main Event seat');
    expect(seat.compareDocumentPosition(hoodie) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
    expect(within(sheet).getByText('Points after')).toBeDefined();
    expect(within(sheet).getByText('2,750 points')).toBeDefined();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Redeem' }));
    expect(await screen.findByText('Redeemed')).toBeDefined();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(redeemed).toEqual([expect.objectContaining({ p_item_id: 'chai', p_points: 500, p_idempotency_key: expect.any(String) })]);
  });

  describe('a reward priced in hotel nights (F-046)', () => {
    const SUITE = { id: 'suite', kind: 'hotel_night', name: 'Partner hotel suite', detail: 'The host confirms', points: null, nights: 1, stock: null, is_live: true, photo_path: null };
    const NIGHTS = { items: [SUITE], features: ['rewards.accommodation'] };

    it('says how many nights short, and cannot be redeemed', async () => {
      renderRewards(3250, NIGHTS);
      const suite = await screen.findByRole('button', { name: '1 night to go, Partner hotel suite' }, LATER);
      expect(suite.hasAttribute('disabled')).toBe(true);
    });

    it('counts part of a night', async () => {
      renderRewards(3250, { ...NIGHTS, nights: 250 });
      expect(await screen.findByRole('button', { name: '0.75 nights to go, Partner hotel suite' }, LATER)).toBeDefined();
    });

    it('can be redeemed with the nights held', async () => {
      renderRewards(3250, { ...NIGHTS, nights: 1000 });
      expect((await screen.findByRole('button', { name: 'Redeem Partner hotel suite' }, LATER)).hasAttribute('disabled')).toBe(false);
    });

    it('has its filter only for a tier with hotel nights', async () => {
      renderRewards(3250, NIGHTS);
      expect(await screen.findByRole('radio', { name: 'Hotel nights' }, LATER)).toBeDefined();
      cleanup();
      renderRewards();
      expect(await screen.findByRole('radio', { name: 'F&B upgrades' }, LATER)).toBeDefined();
      expect(screen.queryByRole('radio', { name: 'Hotel nights' })).toBeNull();
    });
  });

  it('lists a redemption as Ready to collect until it is handed over', async () => {
    renderRewards();
    expect(await screen.findByText('RIVR cap', {}, LATER)).toBeDefined();
    expect(screen.getByText('Ready to collect')).toBeDefined();
  });

  it('says Every reward in reach when every reward still to be had is within reach (one with none left is not next)', async () => {
    renderRewards(4500);
    expect(await screen.findByText('Every reward in reach', {}, LATER)).toBeDefined();
    expect(screen.queryByText(/ to go$/)).toBeNull();
  });
});

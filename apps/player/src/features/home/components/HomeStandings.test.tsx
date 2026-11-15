import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { follows, HOME, LATER, PLACE, renderTonight, SEAT, settled, VERIFIED } from './homeTestKit.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('Home › the card, the offers and no counts in each standing (redesign RD-20)', () => {
  it('Browsing: no referral card while no referral promotion is live (redesign RD-20)', async () => {
    renderTonight([], [], { ...HOME, '/rpc/my_referral': [{ code: 'PGHG59H7', referred: 0, bonus_paise: null }] });
    const offers = await screen.findByRole('region', { name: 'Offers' }, LATER);
    expect(within(offers).getAllByRole('listitem')).toHaveLength(2);
    expect(within(offers).queryByText('Refer a friend')).toBeNull();
  });

  it('Browsing: one card above the offers, the notice that started last, then the offers, then the tables (redesign RD-20)', async () => {
    renderTonight([], [], HOME);
    const card = await screen.findByRole('article', { name: 'From the club' }, LATER);
    expect(card.textContent).toContain('Kitchen closes at 1 tonight.');
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(within(card).queryByRole('button')).toBeNull();
    const offers = await screen.findByRole('region', { name: 'Offers' }, LATER);
    expect(follows(card, offers)).toBe(true);
    expect(follows(offers, screen.getByRole('button', { name: /Table 1 · NLH 50\/100/ }))).toBe(true);
  });

  it('Browsing: the ID check takes the one card while the desk has not checked the member', async () => {
    renderTonight([], [], { ...HOME, '/rest/v1/kyc_record': { ...VERIFIED, status: 'started', at_club_from: '2026-11-14T10:00:00Z' } });
    expect(await screen.findByRole('article', { name: 'ID check' }, LATER)).toBeDefined();
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.queryByText('Kitchen closes at 1 tonight.')).toBeNull();
  });

  it('On the list: the place, then the one card and the offers (redesign RD-20)', async () => {
    renderTonight([PLACE], [], HOME);
    const leave = await screen.findByRole('button', { name: 'Leave waitlist' }, LATER);
    const card = await screen.findByRole('article', { name: 'From the club' }, LATER);
    expect(follows(leave, card)).toBe(true);
    expect(follows(card, await screen.findByRole('region', { name: 'Offers' }, LATER))).toBe(true);
  });

  it('Seat ready: neither the card nor the offers, only the seat held', async () => {
    renderTonight([{ ...PLACE, call_table_name: 'Table 1', call_seat: 4, called_at: '2026-11-15T17:04:00Z', hold_until: '2026-11-15T17:24:00Z' }], [], HOME);
    expect(await screen.findByRole('button', { name: "I'm on my way" }, LATER)).toBeDefined();
    await settled();
    expect(screen.queryByRole('article')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Offers' })).toBeNull();
  });

  it('Seated: no card, and the offers under the seat (redesign RD-20)', async () => {
    renderTonight([], [SEAT], HOME);
    const order = await screen.findByRole('button', { name: 'Order to my seat' }, LATER);
    expect(follows(order, await screen.findByRole('region', { name: 'Offers' }, LATER))).toBe(true);
    await settled();
    expect(screen.queryByRole('article')).toBeNull();
  });

  // Owner, 8 Nov and 15 Nov: a player never sees how many are seated, how many wait or how many seats are open.
  it.each([
    ['browsing', [], []],
    ['on a list', [PLACE], []],
    ['called', [{ ...PLACE, call_table_name: 'Table 1', call_seat: 4, called_at: '2026-11-15T17:04:00Z', hold_until: '2026-11-15T17:24:00Z' }], []],
    ['seated', [], [SEAT]],
  ])('No count of players seated, waiting or seats open while %s, even when the server sends them', async (_standing, places, seat) => {
    renderTonight(places, seat, {
      ...HOME,
      '/rpc/waitlist_lengths': [{ table_id: 't1', waiting: 7, call_time_minutes: 180 }, { table_id: 't4', waiting: 2, call_time_minutes: 180 }],
    });
    await screen.findByRole('heading', { name: 'Home', level: 1 }, LATER);
    await settled();
    expect(document.body.textContent).not.toMatch(/\d+ (waiting|open|seated|playing|players)|seats? open|No wait|Full/i);
  });
});

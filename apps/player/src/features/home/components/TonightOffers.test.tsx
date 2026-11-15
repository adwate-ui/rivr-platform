import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TonightOffers } from './TonightOffers.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const LATER = { timeout: 5000 };
const FEED = [{ feature_key: 'promotions.feed', state: 'enabled', tiers: null }];
const CARDS = [
  { promotion_id: 'p9', title: 'High hand bonus', detail: 'Up to 25,000 Bonus a hand', runs: 'all stakes · every day, all day', link: null },
  { promotion_id: 'p2', title: 'Four-hour bonus', detail: '1,000 Bonus after 4 hours', runs: 'Fri, Sat', link: null },
];
const HIGH_HAND = [{
  promotion_id: 'p9', name: 'High hand bonus',
  reward: {
    kind: 'high_hand', rules: { bothHoleCards: true, shownAtShowdown: true, minPlayersDealt: 4 },
    hands: [{ hand: 'royal_flush', chips: 25000 }, { hand: 'straight_flush', chips: 10000 }, { hand: 'four_of_a_kind', chips: 5000 }],
  },
}];

/** A member's offers over a fake API that answers each read by its path; any other read is empty. */
function renderOffers(replies: Record<string, unknown>) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000262', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    const path = Object.keys(replies).find((one) => url.endsWith(one));
    return Response.json(path === undefined ? [] : replies[path]);
  });
  const router = createRouter({ routeTree: createRootRoute({ component: TonightOffers }), history: createMemoryHistory({ initialEntries: ['/'] }) });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </RivrDataProvider>,
  );
}

describe('the high hand among the offers (redesign RD-25)', () => {
  it('is one card with its hands and their Bonus, in place of its promotion\'s own', async () => {
    renderOffers({ '/rpc/my_feature_access': FEED, '/rpc/my_promotion_cards': CARDS, '/rpc/my_high_hand': HIGH_HAND });
    const hands = await screen.findByText('Royal flush 25,000 · Straight flush 10,000 · Four of a kind 5,000', {}, LATER);
    const offers = hands.closest('section');
    if (offers === null) throw new Error('No offers row');
    expect(within(offers).getByText('2 offers')).toBeDefined();
    expect(within(offers).queryByText('Up to 25,000 Bonus a hand')).toBeNull();
    expect(within(offers).getByText('1,000 Bonus after 4 hours')).toBeDefined();
  });

  it('is no card for a member whose tier has no offers, nor while no high hand runs', async () => {
    renderOffers({ '/rpc/my_feature_access': [], '/rpc/my_promotion_cards': CARDS, '/rpc/my_high_hand': HIGH_HAND });
    await new Promise((resolve) => { setTimeout(resolve, 300); });
    expect(screen.queryByText(/Royal flush/)).toBeNull();
    cleanup();
    renderOffers({ '/rpc/my_feature_access': FEED, '/rpc/my_promotion_cards': CARDS, '/rpc/my_high_hand': [] });
    expect(await screen.findByText('Up to 25,000 Bonus a hand', {}, LATER)).toBeDefined();
    expect(screen.queryByText(/Royal flush/)).toBeNull();
  });
});

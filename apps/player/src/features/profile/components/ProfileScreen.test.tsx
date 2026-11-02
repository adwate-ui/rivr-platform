import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { Text, ToastProvider } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProfileScreen } from './ProfileScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const FEATURES = ['push.seat_ready', 'push.call_time_complete', 'learn.library'].map((feature_key) => ({ feature_key, state: 'enabled', tiers: null }));
const CARD = { member_number: 901, full_name: 'Meera Iyer', tier_name: 'Founders’ Circle', code: 'c0de', ms_left: 30000, photo_path: null };

/** Meera signed in on +91 90000 00901, opening Profile from Rewards; feedback she sends goes to `sent`. */
function renderProfile() {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000241', aud: 'authenticated', phone: '919000000901', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const sent: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/my_feature_access')) return Response.json(FEATURES);
    if (url.includes('/rest/v1/member?')) return Response.json({ id: 'm1', full_name: 'Meera Iyer' });
    if (url.includes('/rpc/my_membership_card')) return Response.json([CARD]);
    if (url.includes('/rest/v1/member_preference')) return Response.json({ games: [], small_blind: null, big_blind: null, name_on_tvs: true });
    if (url.includes('/rpc/has_my_consent')) return Response.json(false);
    if (url.includes('/rpc/send_quick_feedback') || url.includes('/rpc/send_detailed_feedback')) {
      sent.push(JSON.parse(String(init?.body)));
      return Response.json(null);
    }
    return Response.json([]);
  });
  const rootRoute = createRootRoute({ component: () => <ToastProvider><Outlet /></ToastProvider> });
  const page = (path: string, name: string) => createRoute({ getParentRoute: () => rootRoute, path, component: () => <Text>{name}</Text> });
  const profile = createRoute({ getParentRoute: () => rootRoute, path: '/profile', component: ProfileScreen });
  const router = createRouter({
    routeTree: rootRoute.addChildren([page('/rewards', 'Rewards screen'), page('/card', 'Card screen'), page('/profile/rules', 'Rules screen'), profile]),
    history: createMemoryHistory({ initialEntries: ['/rewards', '/profile'], initialIndex: 1 }),
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </RivrDataProvider>,
  );
  return { router, sent };
}

const LATER = { timeout: 5000 };

describe('Profile', () => {
  it('shows the member, then Account, Notifications and Club, and no games, limits or break', async () => {
    renderProfile();
    expect(await screen.findByRole('heading', { level: 1, name: 'Meera Iyer' }, LATER)).toBeDefined();
    expect(await screen.findByText(/^Founders’ Circle · \+91/, {}, LATER)).toBeDefined();
    for (const group of ['Account', 'Notifications', 'Club']) expect(screen.getByText(group)).toBeDefined();
    expect(screen.getByText('Verified')).toBeDefined();
    expect(await screen.findByRole('switch', { name: /Seat calls/ }, LATER)).toBeDefined();
    expect(screen.getByRole('switch', { name: /Call time/ })).toBeDefined();
    expect(screen.queryByText(/limit|take a break|waitlist alerts/i)).toBeNull();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeDefined();
  });

  it('shows Learn for a tier with it, and no Events for one without', async () => {
    renderProfile();
    expect(await screen.findByRole('button', { name: /Learn/ }, LATER)).toBeDefined();
    expect(screen.queryByRole('button', { name: /Events/ })).toBeNull();
  });

  it('opens the card from its row', async () => {
    const { router } = renderProfile();
    fireEvent.click(await screen.findByRole('button', { name: /Membership card/ }, LATER));
    await waitFor(() => expect(router.state.location.pathname).toBe('/card'));
  });

  it('goes back to the tab it was opened from', async () => {
    const { router } = renderProfile();
    fireEvent.click(await screen.findByRole('button', { name: 'Back' }, LATER));
    await waitFor(() => expect(router.state.location.pathname).toBe('/rewards'));
  });

  it('sends feedback from its sheet, with a topic, then says so', async () => {
    const { sent } = renderProfile();
    fireEvent.click(await screen.findByRole('button', { name: /Send feedback/ }, LATER));
    const sheet = await screen.findByRole('dialog', { name: 'Send feedback' });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Dealer' }));
    fireEvent.change(within(sheet).getByLabelText('What happened?'), { target: { value: 'Slow deal at Table 3' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Feedback sent', {}, LATER)).toBeDefined();
    expect(sent).toEqual([{ p_topic: 'dealer', p_note: 'Slow deal at Table 3' }]);
  });

  it('keeps the detailed form a tab away in the feedback sheet', async () => {
    const { sent } = renderProfile();
    fireEvent.click(await screen.findByRole('button', { name: /Send feedback/ }, LATER));
    const sheet = await screen.findByRole('dialog', { name: 'Send feedback' });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Detailed feedback' }));
    for (const area of ['The gameplay, 1 to 5', 'The cashier, 1 to 5', 'The service, 1 to 5', 'The ambience, 1 to 5']) {
      fireEvent.click(within(within(sheet).getByRole('group', { name: area })).getByRole('button', { name: '4' }));
    }
    fireEvent.click(within(within(sheet).getByRole('group', { name: /recommend RIVR/ })).getByRole('button', { name: '9' }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Feedback sent', {}, LATER)).toBeDefined();
    expect(sent).toEqual([{ p_ratings: { gameplay: 4, cashier: 4, service: 4, ambience: 4 }, p_nps: 9, p_note: '' }]);
  });
});

import { CLUB_CONTACT } from '@rivr/contracts/club';
import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { DeskHelpProvider, Text, ToastProvider } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HouseRulesScreen } from './HouseRulesScreen.tsx';
import { ProfileScreen } from './ProfileScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const FEATURES = ['push.seat_ready', 'push.call_time_complete', 'push.bonus', 'learn.library'].map((feature_key) => ({ feature_key, state: 'enabled', tiers: null }));
const CARD = { member_number: 901, full_name: 'Meera Iyer', tier_name: 'Founders’ Circle', code: 'c0de', ms_left: 30000, photo_path: null };

/** What each read Profile makes is answered with, by a part of its address; undefined for any other. */
function readAnswer(url: string, card: object): unknown {
  const reads: readonly (readonly [string, unknown])[] = [
    ['/rpc/my_feature_access', FEATURES],
    ['/rest/v1/member?', { id: 'm1', full_name: 'Meera Iyer' }],
    ['/rpc/my_membership_card', [card]],
    ['/rest/v1/member_preference', { games: [], small_blind: null, big_blind: null, name_on_tvs: true }],
    ['/rpc/has_my_consent', false],
    ['/functions/v1/kyc-image-url', { signedPath: '/object/sign/kyc/v/m/selfie.jpg?token=one-minute' }],
  ];
  return reads.find(([part]) => url.includes(part))?.[1];
}

/** Meera signed in on +91 90000 00901, opening Profile from Rewards; feedback she sends goes to `sent`. */
function renderProfile(card: object = CARD) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000241', aud: 'authenticated', phone: '919000000901', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const sent: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const answer = readAnswer(url, card);
    if (answer !== undefined) return Response.json(answer);
    if (url.includes('/rpc/send_quick_feedback') || url.includes('/rpc/send_detailed_feedback')) {
      sent.push(JSON.parse(String(init?.body)));
      return Response.json(null);
    }
    return Response.json([]);
  });
  // As AppRoot gives every screen: the toasts and the club's number for the front desk.
  const rootRoute = createRootRoute({ component: () => <DeskHelpProvider contact={CLUB_CONTACT}><ToastProvider><Outlet /></ToastProvider></DeskHelpProvider> });
  const page = (path: string, name: string) => createRoute({ getParentRoute: () => rootRoute, path, component: () => <Text>{name}</Text> });
  const profile = createRoute({ getParentRoute: () => rootRoute, path: '/profile', component: ProfileScreen });
  const rules = createRoute({ getParentRoute: () => rootRoute, path: '/profile/rules', component: HouseRulesScreen });
  const router = createRouter({
    routeTree: rootRoute.addChildren([page('/rewards', 'Rewards screen'), page('/card', 'Card screen'), rules, profile]),
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
    // Drawn under its own Back button, it still names the page (WCAG 2.4.2).
    expect(document.title).toBe('Profile · RIVR');
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Meera Iyer' }));
    expect(await screen.findByText(/^Founders’ Circle · \+91/, {}, LATER)).toBeDefined();
    for (const group of ['Account', 'Notifications', 'Club']) expect(screen.getByText(group)).toBeDefined();
    expect(screen.getByText('Verified')).toBeDefined();
    expect(await screen.findByRole('switch', { name: /Seat calls/ }, LATER)).toBeDefined();
    expect(screen.getByRole('switch', { name: /Call time/ })).toBeDefined();
    // Bonus chips added or used (decision 0504).
    expect(screen.getByRole('switch', { name: /Bonus chips/ })).toBeDefined();
    expect(screen.queryByText(/limit|take a break|waitlist alerts/i)).toBeNull();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeDefined();
  });

  it('shows a phone that cannot take notifications as a switch off, saying what the kinds below still do (F-169)', async () => {
    renderProfile();
    const phone = await screen.findByRole('switch', { name: /Notifications on this phone/ }, LATER);
    expect(phone).toHaveProperty('disabled', true);
    expect(screen.getByText('These apply once notifications are on.')).toBeDefined();
    // The kinds are the member's on any phone, so they stay usable.
    expect(await screen.findByRole('switch', { name: /Seat calls/ }, LATER)).toHaveProperty('disabled', false);
  });

  it('ends with the way to the front desk, after Sign out, as every step does (8 Nov audit, F-184)', async () => {
    renderProfile();
    const help = await screen.findByRole('group', { name: 'Front desk' }, LATER);
    expect(within(help).getByRole('link', { name: 'Call the desk' }).getAttribute('href')).toBe('tel:+918796580435');
    expect(within(help).getByRole('link', { name: 'WhatsApp the desk' }).getAttribute('href')).toBe('https://wa.me/918796580435');
    expect(screen.getByRole('button', { name: 'Sign out' }).compareDocumentPosition(help)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('shows her verified selfie filling the mark, and her initial without one', async () => {
    renderProfile({ ...CARD, photo_path: 'v/m/selfie.jpg' });
    const photo = await screen.findByRole('img', { name: 'Your photo' }, LATER);
    expect(photo.getAttribute('src')).toContain('/object/sign/kyc/v/m/selfie.jpg');
    cleanup();
    renderProfile();
    expect(await screen.findByRole('heading', { level: 1, name: 'Meera Iyer' }, LATER)).toBeDefined();
    expect(await screen.findByText('M', {}, LATER)).toBeDefined();
    expect(screen.queryByRole('img', { name: 'Your photo' })).toBeNull();
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

  it('goes back from House rules to Profile, and from Profile to the tab: never to House rules again', async () => {
    const { router } = renderProfile();
    fireEvent.click(await screen.findByRole('button', { name: /House rules/ }, LATER));
    await waitFor(() => expect(router.state.location.pathname).toBe('/profile/rules'));
    fireEvent.click(await screen.findByRole('button', { name: 'Profile' }, LATER));
    await waitFor(() => expect(router.state.location.pathname).toBe('/profile'));
    fireEvent.click(await screen.findByRole('button', { name: 'Back' }, LATER));
    await waitFor(() => expect(router.state.location.pathname).toBe('/rewards'));
  });

  it('sends feedback from its sheet, with a topic, then says so', async () => {
    const { sent } = renderProfile();
    fireEvent.click(await screen.findByRole('button', { name: /Send feedback/ }, LATER));
    const sheet = await screen.findByRole('dialog', { name: 'Send feedback' });
    fireEvent.click(within(sheet).getByRole('radio', { name: 'Dealer' }));
    fireEvent.change(within(sheet).getByLabelText('What happened?'), { target: { value: 'Slow deal at Table 3' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Feedback sent', {}, LATER)).toBeDefined();
    expect(sent).toEqual([{ p_topic: 'dealer', p_note: 'Slow deal at Table 3' }]);
  });

  it('keeps the detailed form a tab away in the feedback sheet', async () => {
    const { sent } = renderProfile();
    fireEvent.click(await screen.findByRole('button', { name: /Send feedback/ }, LATER));
    const sheet = await screen.findByRole('dialog', { name: 'Send feedback' });
    fireEvent.click(within(sheet).getByRole('radio', { name: 'Detailed feedback' }));
    for (const area of ['The gameplay, 1 to 5', 'The cashier, 1 to 5', 'The service, 1 to 5', 'The ambience, 1 to 5']) {
      fireEvent.click(within(within(sheet).getByRole('radiogroup', { name: area })).getByRole('radio', { name: '4' }));
    }
    fireEvent.click(within(within(sheet).getByRole('radiogroup', { name: /recommend RIVR/ })).getByRole('radio', { name: '9' }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Feedback sent', {}, LATER)).toBeDefined();
    expect(sent).toEqual([{ p_ratings: { gameplay: 4, cashier: 4, service: 4, ambience: 4 }, p_nps: 9, p_note: '' }]);
  });
});

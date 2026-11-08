import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { clubDay } from '@rivr/domain/clubDay';
import { ToastProvider } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionScreen } from './SessionScreen.tsx';
import { SessionsScreen } from './SessionsScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** Ishaan's session at Table 3, begun at 02:00 IST on the 14th, so the night of 13 Feb, for six hours. */
const SESSION = {
  session_id: 'v1', visit_id: 'v1', opened_at: '2026-02-13T20:30:00+00:00', closed_at: '2026-02-14T02:30:00+00:00', table_name: 'Table 3',
  small_blind_paise: 10000, big_blind_paise: 20000, played_seconds: 21600, buy_in_paise: 1000000, bonus_paise: 0,
  cash_out_paise: 5000000, tds_paise: 1200000, paid_paise: 3800000, net_paise: 2800000, receipt: 'A1B2C3D4', month: '2026-02-01',
  month_sessions: 1, month_played_seconds: 21600, month_net_paise: 2800000, tds_basis: 'session',
  kind: 'cash', place: null, entrants: null,
};

interface Api {
  sessions?: readonly ({ session_id: string } & Record<string, unknown>)[];
  /** Session history for Ishaan's tier: enabled, or locked to the Black card. */
  access?: 'enabled' | 'locked';
  /** Whether hiding a session goes through. */
  hide?: 'works' | 'fails';
  /** The feature map: given, on its way for good, or failing once and then given (a weak signal in the club). */
  map?: 'given' | 'on its way' | 'fails once';
}

/** The session a hide_my_session call names. */
function sentSessionId(init: RequestInit | undefined): string {
  const sent: unknown = JSON.parse(String(init?.body));
  return sent !== null && typeof sent === 'object' && 'p_session_id' in sent ? String(sent.p_session_id) : '';
}

/** The rows my_sessions gives for a request: one session by its visit, and no more than its limit, as PostgREST filters a function's rows (F3-28). */
function rowsFor<Row extends { session_id: string }>(url: string, rows: readonly Row[]): readonly Row[] {
  const one = /session_id=eq\.([^&]+)/.exec(url)?.[1];
  const limit = Number(/[?&]limit=(\d+)/.exec(url)?.[1] ?? Infinity);
  return (one === undefined ? rows : rows.filter((row) => row.session_id === one)).slice(0, limit);
}

/**
 * Ishaan signed in at `path`, and a fake API: his sessions, his tier's session history as the feature map gives it, and
 * hiding one, which leaves it out after.
 */
function renderAt(path: string, { sessions = [], access = 'enabled', hide = 'works', map = 'given' }: Api) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000211', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  let listed = sessions;
  const hidden: string[] = [];
  let mapAsked = 0;
  const featureMap = (): Promise<Response> | Response => {
    if (map === 'on its way') return new Promise<Response>(() => undefined);
    if (map === 'fails once' && mapAsked++ === 0) return Response.json({ message: 'unavailable' }, { status: 503 });
    return Response.json([{ feature_key: 'sessions.history', state: access, tiers: access === 'locked' ? ['Black card'] : null }]);
  };
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/my_feature_access')) return featureMap();
    if (url.includes('/rpc/hide_my_session')) {
      if (hide === 'fails') return Response.json({ message: 'unavailable' }, { status: 503 });
      const id = sentSessionId(init);
      hidden.push(id);
      listed = listed.filter((one) => one.session_id !== id);
      return Response.json(null);
    }
    if (url.includes('/rpc/my_sessions')) return Response.json(access === 'locked' ? [] : rowsFor(url, listed));
    return Response.json([]);
  });
  const rootRoute = createRootRoute({ component: () => <ToastProvider><Outlet /></ToastProvider> });
  const routeTree = rootRoute.addChildren([
    createRoute({ getParentRoute: () => rootRoute, path: '/sessions', component: SessionsScreen }),
    createRoute({ getParentRoute: () => rootRoute, path: '/sessions/$sessionId', component: SessionScreen }),
  ]);
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [path] }) });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </RivrDataProvider>,
  );
  return { router, hidden };
}

describe('Sessions', () => {
  it.each(['/sessions', '/sessions/v1'])('%s says it is loading while the feature map is on its way', async (path) => {
    renderAt(path, { sessions: [SESSION], map: 'on its way' });
    expect(await screen.findByText('Loading')).toBeDefined();
    // Still loading once the sessions have come.
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(screen.getByText('Loading')).toBeDefined();
  });

  it.each([['/sessions', 'Check your connection and try again.'], ['/sessions/v1', 'Not loaded. Try again.']])('%s says it could not load when the feature map fails, and loads on Try again', async (path, words) => {
    renderAt(path, { sessions: [SESSION], map: 'fails once' });
    expect(await screen.findByText(words)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.queryByText(words)).toBeNull());
    expect(screen.getAllByText(/Table 3/).length).toBeGreaterThan(0);
  });

  it('says there are none yet', async () => {
    renderAt('/sessions', {});
    expect(await screen.findByText('No sessions yet. Each night you play at the club shows here.', {}, { timeout: 5000 })).toBeDefined();
  });

  it('lists each session by the day its night began, a table each (the owner, 9 Nov), with its hours and no money', async () => {
    renderAt('/sessions', { sessions: [SESSION, { ...SESSION, session_id: 's2', table_name: 'Table 2', played_seconds: 5400 }] });
    const row = await screen.findByRole('button', { name: /Table 3/ }, { timeout: 5000 });
    expect(row.textContent).toContain('13 Feb 2026');
    expect(row.textContent).toContain('6 h');
    // A move to Table 2 the same night is a session of its own, named by its table alone.
    expect(screen.getByRole('button', { name: /Table 2/ }).textContent).toContain('1 h 30 min');
    expect(screen.queryByText(/and 1 more/)).toBeNull();
    expect(screen.queryByText(/₹/)).toBeNull();
  });

  it('shows the locked notice for a tier without session history', async () => {
    renderAt('/sessions', { sessions: [SESSION], access: 'locked' });
    expect(await screen.findByText('Black card only.', {}, { timeout: 5000 })).toBeDefined();
    expect(screen.queryByRole('button', { name: /Table 3/ })).toBeNull();
    // Under the screen's own heading (F3-21).
    expect(screen.getByRole('heading', { level: 1, name: 'Sessions' })).toBeDefined();
  });

  it('reads thirty at a time, with Show earlier sessions (F3-28)', async () => {
    const many = Array.from({ length: 31 }, (_, at) => ({ ...SESSION, session_id: `v${String(at + 1)}`, visit_id: `v${String(at + 1)}` }));
    renderAt('/sessions', { sessions: many });
    const earlier = await screen.findByRole('button', { name: 'Show earlier sessions' }, { timeout: 5000 });
    expect(screen.getAllByRole('button', { name: /Table 3/ })).toHaveLength(30);
    fireEvent.click(earlier);
    await vi.waitFor(() => expect(screen.getAllByRole('button', { name: /Table 3/ })).toHaveLength(31));
    expect(screen.queryByRole('button', { name: 'Show earlier sessions' })).toBeNull();
  });

  it('counts this club month whole, as the server totals it, past the page (F3-28)', async () => {
    const month = `${clubDay(new Date()).slice(0, 7)}-01`;
    renderAt('/sessions', { sessions: [{ ...SESSION, month, month_sessions: 34, month_played_seconds: 27000 }] });
    const stats = await screen.findByText('This month', {}, { timeout: 5000 });
    expect(stats.nextElementSibling?.textContent).toBe('34');
    expect(screen.getByText('Hours played').nextElementSibling?.textContent).toBe('7h 30m');
  });

  it('reads 0 this month when the latest session was in an earlier month', async () => {
    renderAt('/sessions', { sessions: [SESSION] });
    const stats = await screen.findByText('This month', {}, { timeout: 5000 });
    expect(stats.nextElementSibling?.textContent).toBe('0');
    expect(screen.getByText('Hours played').nextElementSibling?.textContent).toBe('0h 00m');
  });
});

describe('a session', () => {
  it('shows when it was and how long, and no money, buy-in, TDS or receipt', async () => {
    renderAt('/sessions/v1', { sessions: [SESSION] });
    expect(await screen.findByText('13 Feb 2026', {}, { timeout: 5000 })).toBeDefined();
    expect(screen.getByText('02:00 to 08:00')).toBeDefined();
    expect(screen.getByText('100/200')).toBeDefined();
    expect(screen.getByText('6h 00m')).toBeDefined();
    expect(screen.queryByText(/₹/)).toBeNull();
    expect(screen.queryByText(/TDS|Receipt|Buy-in|Cash-out/)).toBeNull();
    // Drawn under its own Back button, it names the page after the session and takes the focus (WCAG 2.4.2).
    expect(document.title).toBe('Table 3 · RIVR');
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Table 3' }));
  });

  it('shows a tournament with its place in the field', async () => {
    renderAt('/sessions/t1', { sessions: [{ ...SESSION, session_id: 't1', visit_id: 't1', table_name: 'RIVR Sunday', kind: 'tournament', place: 4, entrants: 61 }] });
    expect(await screen.findByText('Tournament · place 4 of 61', {}, { timeout: 5000 })).toBeDefined();
  });

  it('hides it from the member’s own list, says so, and goes back to the list without it', async () => {
    const { router, hidden } = renderAt('/sessions/v1', { sessions: [SESSION] });
    fireEvent.click(await screen.findByRole('button', { name: 'Hide from my list' }, { timeout: 5000 }));
    expect(await screen.findByText('No sessions yet. Each night you play at the club shows here.', {}, { timeout: 5000 })).toBeDefined();
    expect(screen.getByText('Hidden from your list')).toBeDefined();
    expect(router.state.location.pathname).toBe('/sessions');
    expect(hidden).toEqual(['v1']);
  });

  it('says so when hiding does not go through, and stays on the session', async () => {
    renderAt('/sessions/v1', { sessions: [SESSION], hide: 'fails' });
    fireEvent.click(await screen.findByRole('button', { name: 'Hide from my list' }, { timeout: 5000 }));
    expect(await screen.findByText('Not sent. Try again.', {}, { timeout: 5000 })).toBeDefined();
    expect(screen.getByText('02:00 to 08:00')).toBeDefined();
  });

  it('says a session not in the history is not there', async () => {
    renderAt('/sessions/v9', { sessions: [SESSION] });
    expect(await screen.findByText('This session is not in your history.', {}, { timeout: 5000 })).toBeDefined();
  });

  it('shows a locked session under its heading, with back to Sessions (F3-21)', async () => {
    renderAt('/sessions/v1', { sessions: [SESSION], access: 'locked' });
    expect(await screen.findByText('Black card only.', {}, { timeout: 5000 })).toBeDefined();
    expect(screen.getByRole('heading', { level: 1, name: 'Sessions' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Sessions' })).toBeDefined();
  });

  it('goes back from a session opened from the list, adding no page to the history (F3-22)', async () => {
    const { router } = renderAt('/sessions', { sessions: [SESSION] });
    fireEvent.click(await screen.findByRole('button', { name: /Table 3/ }, { timeout: 5000 }));
    await screen.findByRole('button', { name: 'Sessions' }, { timeout: 5000 });
    expect(router.history.length).toBe(2);
    fireEvent.click(screen.getByRole('button', { name: 'Sessions' }));
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/sessions'));
    expect(router.history.length).toBe(2);
    expect(router.history.canGoBack()).toBe(false);
  });

  it('goes to the list in its place from a session opened by its address (F3-22)', async () => {
    const { router } = renderAt('/sessions/v1', { sessions: [SESSION] });
    fireEvent.click(await screen.findByRole('button', { name: 'Sessions' }, { timeout: 5000 }));
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/sessions'));
    expect(router.history.length).toBe(1);
  });
});

import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
  visit_id: 'v1', opened_at: '2026-02-13T20:30:00+00:00', closed_at: '2026-02-14T02:30:00+00:00', table_name: 'Table 3',
  small_blind_paise: 10000, big_blind_paise: 20000, other_tables: 0, played_seconds: 21600, buy_in_paise: 1000000, bonus_paise: 0,
  cash_out_paise: 5000000, tds_paise: 1200000, paid_paise: 3800000, net_paise: 2800000, receipt: 'A1B2C3D4', month: '2026-02-01',
  month_sessions: 1, month_played_seconds: 21600, month_net_paise: 2800000, tds_basis: 'session',
  kind: 'cash', place: null, entrants: null,
};

interface Api {
  sessions?: readonly ({ visit_id: string } & Record<string, unknown>)[];
  /** Session history for Ishaan's tier: enabled, or locked to the Black card. */
  access?: 'enabled' | 'locked';
  /** Whether hiding a session goes through. */
  hide?: 'works' | 'fails';
}

/** The session a hide_my_session call names. */
function sentSessionId(init: RequestInit | undefined): string {
  const sent: unknown = JSON.parse(String(init?.body));
  return sent !== null && typeof sent === 'object' && 'p_session_id' in sent ? String(sent.p_session_id) : '';
}

/** Ishaan signed in at `path`, and a fake API: his sessions, his tier's session history, and hiding one, which leaves it out after. */
function renderAt(path: string, { sessions = [], access = 'enabled', hide = 'works' }: Api) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000211', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  let listed = sessions;
  const hidden: string[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/my_feature_access')) {
      return Response.json([{ feature_key: 'sessions.history', state: access, tiers: access === 'locked' ? ['Black card'] : null }]);
    }
    if (url.includes('/rpc/hide_my_session')) {
      if (hide === 'fails') return Response.json({ message: 'unavailable' }, { status: 503 });
      const id = sentSessionId(init);
      hidden.push(id);
      listed = listed.filter((one) => one.visit_id !== id);
      return Response.json(null);
    }
    if (url.includes('/rpc/my_sessions')) return Response.json(access === 'locked' ? [] : listed);
    return Response.json([]);
  });
  const rootRoute = createRootRoute();
  const routeTree = rootRoute.addChildren([
    createRoute({ getParentRoute: () => rootRoute, path: '/sessions', component: SessionsScreen }),
    createRoute({ getParentRoute: () => rootRoute, path: '/sessions/$visitId', component: SessionScreen }),
  ]);
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [path] }) });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}>
      <RouterProvider router={router} />
    </RivrDataProvider>,
  );
  return { router, hidden };
}

describe('Sessions', () => {
  it('says there are none yet', async () => {
    renderAt('/sessions', {});
    expect(await screen.findByText('No sessions yet.', {}, { timeout: 5000 })).toBeDefined();
  });

  it('lists a session under its club month, by the day its night began, with its tables and hours and no money', async () => {
    renderAt('/sessions', { sessions: [SESSION, { ...SESSION, visit_id: 'v2', table_name: 'Table 2', other_tables: 1, played_seconds: 5400 }] });
    expect(await screen.findByRole('heading', { name: 'February 2026' }, { timeout: 5000 })).toBeDefined();
    expect(screen.getByText('2 sessions · 7 h 30 min')).toBeDefined();
    const row = screen.getByRole('button', { name: /Table 3/ });
    expect(row.textContent).toContain('13 Feb 2026');
    expect(row.textContent).toContain('6 h');
    expect(screen.getByRole('button', { name: /Table 2 and 1 more/ }).textContent).toContain('1 h 30 min');
    expect(screen.queryByText(/₹/)).toBeNull();
  });

  it('shows the locked notice for a tier without session history', async () => {
    renderAt('/sessions', { sessions: [SESSION], access: 'locked' });
    expect(await screen.findByText('Black card only.', {}, { timeout: 5000 })).toBeDefined();
    expect(screen.queryByRole('button', { name: /Table 3/ })).toBeNull();
  });
});

describe('a session', () => {
  it('shows when it was and how long, and no money, buy-in, TDS or receipt', async () => {
    renderAt('/sessions/v1', { sessions: [SESSION] });
    expect(await screen.findByText('13 Feb 2026', {}, { timeout: 5000 })).toBeDefined();
    expect(screen.getByText('02:00 to 08:00')).toBeDefined();
    expect(screen.getByText('6 h')).toBeDefined();
    expect(screen.queryByText(/₹/)).toBeNull();
    expect(screen.queryByText(/TDS|Receipt|Buy-in|Cash-out/)).toBeNull();
  });

  it('shows a tournament with its place in the field', async () => {
    renderAt('/sessions/t1', { sessions: [{ ...SESSION, visit_id: 't1', table_name: 'RIVR Sunday', kind: 'tournament', place: 4, entrants: 61 }] });
    expect(await screen.findByText('Tournament · place 4 of 61 · 6 h', {}, { timeout: 5000 })).toBeDefined();
  });

  it('hides it from the member’s own list and goes back to the list without it', async () => {
    const { router, hidden } = renderAt('/sessions/v1', { sessions: [SESSION] });
    fireEvent.click(await screen.findByRole('button', { name: 'Hide from my sessions' }, { timeout: 5000 }));
    expect(await screen.findByText('No sessions yet.', {}, { timeout: 5000 })).toBeDefined();
    expect(router.state.location.pathname).toBe('/sessions');
    expect(hidden).toEqual(['v1']);
  });

  it('says so when hiding does not go through, and stays on the session', async () => {
    renderAt('/sessions/v1', { sessions: [SESSION], hide: 'fails' });
    fireEvent.click(await screen.findByRole('button', { name: 'Hide from my sessions' }, { timeout: 5000 }));
    expect(await screen.findByText('That did not go through. Check the connection and try again.', {}, { timeout: 5000 })).toBeDefined();
    expect(screen.getByText('02:00 to 08:00')).toBeDefined();
  });

  it('says a session not in the history is not there', async () => {
    renderAt('/sessions/v9', { sessions: [SESSION] });
    expect(await screen.findByText('This session is not in your history.', {}, { timeout: 5000 })).toBeDefined();
  });
});

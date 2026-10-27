import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionScreen } from './SessionScreen.tsx';
import { SessionsScreen } from './SessionsScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** Ishaan's session at Table 3, begun at 02:00 IST on the 14th, so the night of 13 Feb: ₹10,000 in, ₹50,000 out, ₹12,000 TDS. */
const SESSION = {
  visit_id: 'v1', opened_at: '2026-02-13T20:30:00+00:00', closed_at: '2026-02-13T22:00:00+00:00', table_name: 'Table 3',
  small_blind_paise: 10000, big_blind_paise: 20000, other_tables: 0, played_seconds: 21600, buy_in_paise: 1000000, bonus_paise: 0,
  cash_out_paise: 5000000, tds_paise: 1200000, paid_paise: 3800000, net_paise: 2800000, receipt: 'A1B2C3D4', month: '2026-02-01',
  month_sessions: 1, month_played_seconds: 21600, month_net_paise: 2800000, tds_basis: 'session',
  kind: 'cash', place: null, entrants: null,
};

interface Api {
  sessions?: unknown[];
  /** Session history for Ishaan's tier: enabled, or locked to the Black card. */
  access?: 'enabled' | 'locked';
}

/** Ishaan signed in at `path`, and a fake API: his sessions, no TDS certificates, and his tier's session history. */
function renderAt(path: string, { sessions = [], access = 'enabled' }: Api) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000211', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/my_feature_access')) {
      return Response.json([{ feature_key: 'sessions.history', state: access, tiers: access === 'locked' ? ['Black card'] : null }]);
    }
    if (url.includes('/rpc/my_sessions')) return Response.json(access === 'locked' ? [] : sessions);
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
}

describe('Sessions', () => {
  it('says there are none yet', async () => {
    renderAt('/sessions', {});
    expect(await screen.findByText('No sessions yet.')).toBeDefined();
  });

  it('lists a session under its club month, by the day its night began', async () => {
    renderAt('/sessions', { sessions: [SESSION] });
    expect(await screen.findByRole('heading', { name: 'February 2026' })).toBeDefined();
    expect(screen.getByText('1 session · 6 h')).toBeDefined();
    const row = screen.getByRole('button', { name: /Table 3/ });
    expect(row.textContent).toContain('13 Feb 2026');
    expect(row.textContent).toContain('+₹28,000');
  });

  it('shows the locked notice for a tier without session history', async () => {
    renderAt('/sessions', { sessions: [SESSION], access: 'locked' });
    expect(await screen.findByText('Black card only.')).toBeDefined();
    expect(screen.queryByRole('button', { name: /Table 3/ })).toBeNull();
  });
});

describe('a session', () => {
  it('shows the TDS withheld and what was paid when TDS applied, then the net and the receipt', async () => {
    renderAt('/sessions/v1', { sessions: [SESSION] });
    expect(await screen.findByText('TDS withheld')).toBeDefined();
    expect(screen.getByText('₹12,000')).toBeDefined();
    expect(screen.getByText('Paid to you')).toBeDefined();
    expect(screen.getByText('₹38,000')).toBeDefined();
    expect(screen.getByText('+₹28,000')).toBeDefined();
    expect(screen.getByText('Receipt A1B2C3D4')).toBeDefined();
  });

  it('says the TDS was on the period\u2019s winnings under the day and financial-year bases, not under the session\u2019s', async () => {
    renderAt('/sessions/v1', { sessions: [{ ...SESSION, tds_basis: 'financial_year' }] });
    expect(await screen.findByText('TDS on this year\u2019s winnings')).toBeDefined();
    cleanup();
    renderAt('/sessions/v1', { sessions: [{ ...SESSION, tds_basis: 'day' }] });
    expect(await screen.findByText('TDS on the day\u2019s winnings')).toBeDefined();
    cleanup();
    renderAt('/sessions/v1', { sessions: [{ ...SESSION, tds_basis: 'session' }] });
    expect(await screen.findByText('TDS withheld')).toBeDefined();
    expect(screen.queryByText(/winnings$/)).toBeNull();
  });

  it('shows a tournament with its place in the field, and its prize', async () => {
    renderAt('/sessions/t1', { sessions: [{ ...SESSION, visit_id: 't1', table_name: 'RIVR Sunday', kind: 'tournament', place: 4, entrants: 61 }] });
    expect(await screen.findByText('Tournament · place 4 of 61')).toBeDefined();
    expect(screen.getByText('Prize')).toBeDefined();
  });

  it('has no TDS line, nor what was paid, when none was withheld', async () => {
    renderAt('/sessions/v1', { sessions: [{ ...SESSION, tds_paise: 0, paid_paise: 5000000, net_paise: 4000000 }] });
    expect(await screen.findByText('Cash-out')).toBeDefined();
    expect(screen.queryByText('TDS withheld')).toBeNull();
    expect(screen.queryByText('Paid to you')).toBeNull();
  });

  it('says a session not in the history is not there', async () => {
    renderAt('/sessions/v9', { sessions: [SESSION] });
    expect(await screen.findByText('This session is not in your history.')).toBeDefined();
  });
});

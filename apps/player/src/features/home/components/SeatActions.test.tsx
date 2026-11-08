import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, type MySeat } from '@rivr/db';
import { ToastProvider } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SeatActions } from './SeatActions.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const SEAT: MySeat = {
  tableName: 'Table 1', seat: 4, isAway: false, hasCallTime: true, callTimeLeft: 9668, playedSeconds: 1140, isLeaving: false, topUp: null,
  callTimeMinutes: 180, startedAt: '2026-11-15T16:55:30Z', callTimeEndsAt: null, tableTypeName: 'NLH 50/100', smallBlind: 5000n, bigBlind: 10000n,
  timeRequestMinutes: 60, addTimeChoices: [30, 60, 120],
};

function Seat({ seat }: { seat: MySeat }) {
  return (
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })} queryClient={new QueryClient()}>
      <ToastProvider><SeatActions seat={seat} onOpen={() => undefined} /></ToastProvider>
    </RivrDataProvider>
  );
}

describe('Tonight › Seat actions', () => {
  /** A signed-in member whose tier has every seat action. */
  function withEveryAction() {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
      access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: '00000000-0000-4000-8000-000000000231', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
    }));
    const features = ['table.top_up', 'call_time.view', 'table.leave'].map((feature_key) => ({ feature_key, state: 'enabled', tiers: null }));
    vi.stubGlobal('fetch', async () => Response.json(features));
  }
  const gridOf = (action: HTMLElement) => action.closest('.grid')?.className;

  it('gives each action shown a column: three with call time (F-203)', async () => {
    withEveryAction();
    render(<Seat seat={SEAT} />);
    expect(gridOf(await screen.findByRole('button', { name: 'Leave seat' }, { timeout: 5000 }))).toContain('grid-cols-3');
  });

  it('gives each action shown a column: two without call time, so neither leaves a third empty (F-203)', async () => {
    withEveryAction();
    render(<Seat seat={{ ...SEAT, hasCallTime: false }} />);
    expect(gridOf(await screen.findByRole('button', { name: 'Leave seat' }, { timeout: 5000 }))).toContain('grid-cols-2');
  });
});

describe('Tonight › Time requested', () => {
  it('says how much the floor added once it approves: the request goes and the call time grows', () => {
    const { rerender } = render(<Seat seat={SEAT} />);
    expect(screen.queryByText('1 hour added')).toBeNull();
    rerender(<Seat seat={{ ...SEAT, timeRequestMinutes: null, callTimeMinutes: 240, callTimeLeft: 13268 }} />);
    expect(screen.getByText('1 hour added')).toBeDefined();
  });

  it('says nothing when the floor declines: the request goes and the call time stays', () => {
    const { rerender } = render(<Seat seat={SEAT} />);
    rerender(<Seat seat={{ ...SEAT, timeRequestMinutes: null }} />);
    expect(screen.queryByText(/added$/)).toBeNull();
  });
});

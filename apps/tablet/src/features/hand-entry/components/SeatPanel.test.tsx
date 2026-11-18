import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, type TabletPlayer, type TabletSeat } from '@rivr/db';
import { fromPaise } from '@rivr/domain/money';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SeatPanel } from './SeatPanel.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const SEAT: TabletSeat = { seat: 9, smallBlind: fromPaise(10_000n), bigBlind: fromPaise(20_000n), straddle: null, minimum: fromPaise(1_000_000n), player: null };

/** Yash at seat 9, with `callTimeLeft` seconds of call time owed; what the tablet sends to end_seat goes to `sent`. */
function renderPanel(callTimeLeft: number | null, owesCallTime = callTimeLeft !== null && callTimeLeft > 0) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-00000000e001', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const sent: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/end_seat')) sent.push(JSON.parse(String(init?.body)));
    if (url.includes('/rpc/fnb_on')) return Response.json(true);
    return Response.json(url.includes('/rpc/end_seat') ? null : []);
  });
  const player: TabletPlayer = { sessionId: 's9', fullName: 'Yash Gupta', isAway: false, callTimeLeft, owesCallTime, isLeaving: false };
  const onLeft = vi.fn();
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SeatPanel seat={SEAT} player={player} onLeft={onLeft} />
    </RivrDataProvider>,
  );
  return { sent, onLeft };
}

describe('Player left on the tablet asks why', () => {
  it('picks Call time met when none is left, and sends it', async () => {
    const { sent, onLeft } = renderPanel(0);
    fireEvent.click(screen.getByRole('button', { name: 'Player left' }));
    expect(screen.getByRole('radio', { name: 'Call time met' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Yes, Yash Gupta left' }));
    await waitFor(() => expect(onLeft).toHaveBeenCalledOnce());
    expect(sent).toEqual([{ p_session_id: 's9', p_reason: 'left', p_leave_reason: 'call_time_met' }]);
  });

  it('picks none for one who never set a call time, owed though the countdown is done (the owner, 18 Nov)', () => {
    renderPanel(0, true);
    fireEvent.click(screen.getByRole('button', { name: 'Player left' }));
    expect(screen.getAllByRole('radio').some((chip) => chip.getAttribute('aria-checked') === 'true')).toBe(false);
  });

  it('picks none while call time is owed, and says to pick one', async () => {
    const { sent } = renderPanel(1800);
    fireEvent.click(screen.getByRole('button', { name: 'Player left' }));
    expect(screen.getAllByRole('radio').some((chip) => chip.getAttribute('aria-checked') === 'true')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, Yash Gupta left' }));
    expect(screen.getByText('Pick why they leave.')).toBeDefined();
    fireEvent.click(screen.getByRole('radio', { name: 'Busted' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, Yash Gupta left' }));
    await waitFor(() => expect(sent).toEqual([{ p_session_id: 's9', p_reason: 'left', p_leave_reason: 'busted' }]));
  });

  it('goes back to Player left on Cancel, sending nothing', () => {
    const { sent } = renderPanel(0);
    fireEvent.click(screen.getByRole('button', { name: 'Player left' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Player left' })).toBeDefined();
    expect(screen.queryByRole('radio', { name: 'Busted' })).toBeNull();
    expect(sent).toEqual([]);
  });
});

import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModeScreen, turnMs } from './ModeScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** The lobby TV signed in, told to show `boards` for `seconds` each; every board's own read comes back empty. */
function renderTv(boards: readonly string[], seconds: readonly number[]) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-0000000000e1', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    return Response.json(url.includes('/rpc/my_tv_screen') ? [{ device_id: 'd1', venue_id: 'v1', name: 'Lobby TV', boards, seconds }] : []);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ModeScreen />
    </RivrDataProvider>,
  );
}

/** The board now on the screen, once its own read has come. */
const board = (name: string) => screen.findByRole('heading', { level: 1, name });

describe('the boards a TV shows (redesign RD-28)', () => {
  it('gives a board the seconds Settings set for it', () => {
    expect(turnMs({ mode: 'call_time', seconds: 45 })).toBe(45_000);
  });

  it('titles call time Seats opening, and the high hand bonus by its name', async () => {
    renderTv(['call_time'], [30]);
    expect(await screen.findByRole('heading', { level: 1, name: 'Seats opening' })).toBeDefined();
    cleanup();
    renderTv(['high_hand'], [30]);
    expect(await screen.findByRole('heading', { level: 1, name: 'High hand bonus' })).toBeDefined();
  });

  it('turns from one board to the next after the first board’s own seconds, and round again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderTv(['waitlist', 'call_time'], [8, 20]);
    expect(await board('Waitlist')).toBeDefined();
    await act(async () => { await vi.advanceTimersByTimeAsync(7_000); });
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Waitlist');
    await act(async () => { await vi.advanceTimersByTimeAsync(1_500); });
    expect(await board('Seats opening')).toBeDefined();
    await act(async () => { await vi.advanceTimersByTimeAsync(20_500); });
    expect(await board('Waitlist')).toBeDefined();
  });

  it('passes over a board with nothing to show, but never the first', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderTv(['waitlist', 'high_hand', 'call_time'], [8, 30, 20]);
    expect(await board('Waitlist')).toBeDefined();
    await act(async () => { await vi.advanceTimersByTimeAsync(8_500); });
    // The high hand bonus has nothing to show yet, so its turn passes at once to the next board.
    expect(await board('Seats opening')).toBeDefined();
  });
});

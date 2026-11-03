import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WaitingSpins } from './WaitingSpins.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const WAITING = [{ grant_id: 'g1', member_name: 'Kabir Sethi', promotion_name: 'Spin night', granted_at: '2026-11-15T15:00:00Z' }];

/** The floor signed in, one spin waiting, and the wheel's prizes as `prizes`. */
function renderSpins(prizes: readonly object[] | 'failed') {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/waiting_spins')) return Response.json(WAITING);
    if (url.includes('/rpc/spin_prizes')) return prizes === 'failed' ? Response.json({ message: 'down' }, { status: 500 }) : Response.json(prizes);
    return Response.json([]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <WaitingSpins venueId="v1" />
    </RivrDataProvider>,
  );
}

describe('WaitingSpins', () => {
  it('holds Spin while the wheel has no prize to draw, and says what to do (C-08)', async () => {
    renderSpins([]);
    expect(await screen.findByText('The wheel has no prize to draw. Add one, then spin.', {}, { timeout: 5000 })).toBeDefined();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Spin for Kabir Sethi' }).disabled).toBe(true);
  });

  it('says nothing of prizes while the wheel cannot be read, and holds Spin', async () => {
    renderSpins('failed');
    const button = await screen.findByRole<HTMLButtonElement>('button', { name: 'Spin for Kabir Sethi' }, { timeout: 5000 });
    await new Promise((settle) => setTimeout(settle, 300));
    expect(button.disabled).toBe(true);
    expect(screen.queryByText('The wheel has no prize to draw. Add one, then spin.')).toBeNull();
  });

  it('offers Spin once a prize can be drawn', async () => {
    renderSpins([{ prize_id: 'p1', kind: 'points', amount: 500, weight: 1, is_drawable: true }]);
    const button = await screen.findByRole<HTMLButtonElement>('button', { name: 'Spin for Kabir Sethi' }, { timeout: 5000 });
    await vi.waitFor(() => expect(button.disabled).toBe(false));
    expect(screen.queryByText('The wheel has no prize to draw. Add one, then spin.')).toBeNull();
  });
});

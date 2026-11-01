import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrizeTable } from './PrizeTable.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** Aditya, who runs promotions, signed in, and a fake API with one prize on the wheel that keeps each removal sent. */
function renderPrizes() {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const removed: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/remove_spin_prize')) {
      removed.push(JSON.parse(String(init?.body)));
      return new Response(null, { status: 204 });
    }
    if (url.includes('/rpc/spin_prizes')) return Response.json([{ prize_id: 'p1', kind: 'points', amount: 500, weight: 1, is_drawable: true }]);
    return Response.json([]);
  });
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })} queryClient={cache}>
      <PrizeTable venueId="v1" canRemove />
    </RivrDataProvider>,
  );
  return removed;
}

describe('PrizeTable', () => {
  it('removes a prize only on the second press', async () => {
    const removed = renderPrizes();
    fireEvent.click(await screen.findByRole('button', { name: /^Remove / }));
    expect(removed).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: /^Yes, remove / }));
    await waitFor(() => expect(removed).toEqual([{ p_venue_id: 'v1', p_prize_id: 'p1' }]));
  });
});

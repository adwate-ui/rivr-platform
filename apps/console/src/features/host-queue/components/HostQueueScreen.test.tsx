import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HostQueue } from './HostQueueScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** Twenty-five lapsed regulars, Player 1 to Player 25. */
const ROWS = Array.from({ length: 25 }, (_, at) => ({
  item_id: `i${String(at + 1)}`, member_id: `m${String(at + 1)}`, full_name: `Player ${String(at + 1)}`, phone: '+919000000700',
  last_visit_at: '2026-09-28T18:00:00Z', visits: 4, status: 'open', churn_reason: null, offer: null, note: null,
}));

describe('HostQueue', () => {
  it('shows twenty calls, each a whole form, then the rest on Show 5 more (F2-19)', async () => {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = String(input instanceof Request ? input.url : input);
      return Response.json(url.includes('/rpc/host_queue') ? ROWS : []);
    });
    render(
      <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
        queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <HostQueue venueId="v1" />
      </RivrDataProvider>,
    );
    expect(await screen.findByRole('heading', { name: 'Player 20' }, { timeout: 5000 })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Player 21' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show 5 more' }));
    expect(screen.getByRole('heading', { name: 'Player 25' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Show \d+ more$/ })).toBeNull();
  });
});

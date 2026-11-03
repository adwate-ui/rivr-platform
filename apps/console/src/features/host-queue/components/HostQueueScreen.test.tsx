import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HostQueue } from './HostQueueScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** Three lapsed regulars, Player 1 longest gone. */
const ROWS = Array.from({ length: 3 }, (_, at) => ({
  item_id: `i${String(at + 1)}`, member_id: `m${String(at + 1)}`, full_name: `Player ${String(at + 1)}`, phone: '+919000000700',
  last_visit_at: '2026-09-28T18:00:00Z', visits: 4, status: 'open', churn_reason: null, offer: null, note: null,
}));

/** The queue for a host, with the calls the API was asked to record. */
function renderQueue(rows: unknown[] = ROWS) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const recorded: string[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/record_host_contact')) {
      recorded.push(String(init?.body ?? ''));
      return new Response(null, { status: 204 });
    }
    return Response.json(url.includes('/rpc/host_queue') ? rows : []);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <HostQueue venueId="v1" />
    </RivrDataProvider>,
  );
  return recorded;
}

describe('HostQueue', () => {
  it('lists every lapsed regular and opens the longest gone beside the list; picking another opens theirs', async () => {
    renderQueue();
    expect(await screen.findByRole('heading', { name: 'Player 1', level: 2 }, { timeout: 5000 })).toBeDefined();
    const list = screen.getByRole('region', { name: 'Lapsed regulars' });
    for (const name of ['Player 1', 'Player 2', 'Player 3']) expect(list.textContent).toContain(name);
    fireEvent.click(screen.getByRole('button', { name: /^Player 3/ }));
    expect(screen.getByRole('heading', { name: 'Player 3', level: 2 })).toBeDefined();
    expect(screen.getByRole('button', { name: /^Player 3/ }).getAttribute('aria-current')).toBe('true');
  });

  it('refuses to save a call until a reason is chosen, saying so, then saves it', async () => {
    const recorded = renderQueue();
    const save = await screen.findByRole('button', { name: 'Save the call to Player 1' }, { timeout: 5000 });
    fireEvent.click(save);
    expect(screen.getByText('Choose why they stopped coming.')).toBeDefined();
    expect(recorded).toEqual([]);
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Why they stopped coming' })).getByRole('radio', { name: 'Moved away' }));
    fireEvent.click(save);
    expect(await screen.findByText('Call to Player 1 saved.')).toBeDefined();
    expect(recorded[0]).toContain('"p_churn_reason":"moved_away"');
    expect(screen.queryByText('Choose why they stopped coming.')).toBeNull();
  });

  it('says in one line when nobody is left to call', async () => {
    renderQueue([]);
    expect(await screen.findByText('No lapsed regulars to call.', undefined, { timeout: 5000 })).toBeDefined();
  });
});

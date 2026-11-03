import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, type SeatedPlayer } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AddTime } from './AddTime.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const PLAYER: SeatedPlayer = {
  sessionId: 's1', tableId: 't1', seat: 4, memberId: 'm1', fullName: 'Ira Kapoor', tierName: 'Member', startedAt: '2026-11-15T16:55:00Z',
  mustMoveOrder: null, isAway: false, callTimeLeft: 0, leavingAt: null, topUp: null, timeRequest: null,
};

describe('the floor adding call time itself (decision 0305)', () => {
  it('offers the lengths the club ticked, never an amount, and adds the one chosen, met or not', async () => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
      access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
    }));
    const added: unknown[] = [];
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.includes('/rpc/add_time_choices')) return Response.json([45, 90]);
      if (url.includes('/rpc/add_seat_call_time')) {
        added.push(JSON.parse(String(init?.body)));
        return new Response(null, { status: 204 });
      }
      return Response.json([]);
    });
    const report = vi.fn();
    render(
      <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
        queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AddTime venueId="v1" player={PLAYER} report={report} />
      </RivrDataProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Add 1 h 30 min to the call time of Ira Kapoor' }, { timeout: 5000 }));
    await waitFor(() => expect(added).toEqual([{ p_session_id: 's1', p_minutes: 90, p_idempotency_key: expect.any(String) }]));
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(document.body.textContent).not.toContain('₹');
    await waitFor(() => expect(report).toHaveBeenCalledWith({ ok: true, value: null }));
  });
});

import { createRivrClient, RivrDataProvider, type SeatedPlayer } from '@rivr/db';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TimeRequest } from './TimeRequest.tsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const PLAYER: SeatedPlayer & { timeRequest: { id: string; minutes: number } } = {
  sessionId: 's1', tableId: 't1', seat: 4, memberId: 'm1', fullName: 'Ira Kapoor', tierName: 'Member', startedAt: '2026-11-15T16:55:00Z',
  mustMoveOrder: null, isAway: false, callTimeLeft: 600, leavingAt: null, topUp: null, timeRequest: { id: 'r1', minutes: 60 },
};

describe('the floor\'s answer to more call time (decision 0320)', () => {
  it('shows the minutes asked for, never an amount, and approves or declines them', async () => {
    const bodies: unknown[] = [];
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input instanceof Request ? input.url : input).includes('/rpc/decide_call_time_request')) bodies.push(JSON.parse(String(init?.body)));
      return Response.json(null);
    });
    const report = vi.fn();
    render(
      <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}>
        <TimeRequest venueId="v1" player={PLAYER} report={report} />
      </RivrDataProvider>,
    );
    expect(screen.getByText('+1 h asked')).toBeDefined();
    expect(document.body.textContent).not.toContain('₹');
    fireEvent.click(screen.getByRole('button', { name: 'Approve more call time for Ira Kapoor' }));
    await waitFor(() => expect(bodies).toEqual([{ p_request_id: 'r1', p_is_approved: true }]));
    fireEvent.click(screen.getByRole('button', { name: 'Decline more call time for Ira Kapoor' }));
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1]).toEqual({ p_request_id: 'r1', p_is_approved: false });
  });
});

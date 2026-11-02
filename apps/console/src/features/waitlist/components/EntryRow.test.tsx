import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, type WaitlistBoardEntry } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EntryRow } from './EntryRow.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const NAINA: WaitlistBoardEntry = {
  entryId: 'e1', tableTypeId: 'tt', memberId: 'm2', fullName: 'Naina Kapoor', joinedAt: '2026-11-15T15:00:00Z', place: 1, addedByFloor: false,
  priorityReason: null, callTableName: null, callSeat: null, holdUntil: null, awayUntil: null,
};

/** Aditya, the floor, with Naina first on a list, and a fake API that keeps each place taken off. */
function renderEntry() {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const removed: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/leave_waitlist')) {
      removed.push(JSON.parse(String(init?.body)));
      return new Response(null, { status: 204 });
    }
    return Response.json([]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <EntryRow venueId="v1" entry={NAINA} tables={[]} />
    </RivrDataProvider>,
  );
  return removed;
}

describe('a place on the waitlist', () => {
  it('takes the place off only on the second press of Remove, which names the player (F2-32)', async () => {
    const removed = renderEntry();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Naina Kapoor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove Naina Kapoor' }));
    await waitFor(() => expect(removed).toEqual([{ p_entry_id: 'e1' }]));
  });

  it('offers no Call while the game has no open table (F2-18)', () => {
    renderEntry();
    expect(screen.queryByRole('button', { name: 'Assign Naina Kapoor' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Hold place: Naina Kapoor' })).toBeDefined();
  });

  it('shows each action as its verb alone, the name already on the row, and names the player for a screen reader (A-09)', () => {
    renderEntry();
    expect(screen.getByRole('button', { name: 'Hold place: Naina Kapoor' }).textContent).toBe('Hold place');
    expect(screen.getByRole('button', { name: 'Remove Naina Kapoor' }).textContent).toBe('Remove');
  });
});

import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, type FloorTable, type WaitlistRequest } from '@rivr/db';
import { ToastProvider } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TableWaitlist } from './TableWaitlist.tsx';
import { buildFloorTable } from './waitlistFixtures.ts';

const TABLE = buildFloorTable({ tableTypeName: 'NLH 50/100', smallBlind: 5000n, bigBlind: 10000n });
const REQUEST: WaitlistRequest = { entryId: 'r1', memberId: 'm9', fullName: 'Ritika Bhalla', joinedAt: '2026-11-15T15:36:00Z', tableTypeId: 'tt', tableId: 't1' };

let calls: { rpc: string; body: unknown }[] = [];

beforeEach(() => {
  calls = [];
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const rpc = url.split('/rpc/')[1]?.split('?')[0];
    if (rpc !== undefined) calls.push({ rpc, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return Response.json(rpc === undefined ? [] : null);
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

function renderCard(props: { onApproved?: (entryId: string) => void; table?: FloorTable; waiting?: number } = {}) {
  return render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider place="console">
        <TableWaitlist venueId="v1" table={props.table ?? TABLE} waiting={props.waiting ?? 2} requests={[REQUEST]} interest={undefined} canOpen
          onApproved={props.onApproved ?? vi.fn()} />
      </ToastProvider>
    </RivrDataProvider>,
  );
}

describe("a table's waitlist card (console v3)", () => {
  it('names the table, its stake and open seats, and the join asking; its places are rows of the table below (redesign RD-31)', () => {
    renderCard();
    const card = screen.getByRole('heading', { level: 2, name: 'Table 1' }).closest('section') ?? document.body;
    expect(within(card).getByText('NLH 50/100 · 3 open')).toBeDefined();
    expect(within(card).getByText('asks to join')).toBeDefined();
    expect(within(card).queryByRole('button', { name: /^Seat / })).toBeNull();
  });

  it('says a full table is full while someone waits on its list (audit F-030)', () => {
    renderCard({ table: { ...TABLE, openSeats: 0 } });
    expect(screen.getByText('Full. Seat when a seat frees.')).toBeDefined();
    cleanup();
    renderCard({ table: { ...TABLE, openSeats: 0 }, waiting: 0 });
    expect(screen.queryByText('Full. Seat when a seat frees.')).toBeNull();
  });

  it('approves a join onto the list, says so, and leads on to seating them (the owner, 8 Nov)', async () => {
    const onApproved = vi.fn();
    renderCard({ onApproved });
    fireEvent.click(screen.getByRole('button', { name: 'Approve Ritika Bhalla' }));
    await waitFor(() => expect(calls).toContainEqual({ rpc: 'approve_waitlist_request', body: { p_entry_id: 'r1' } }));
    expect(await screen.findByText('Ritika Bhalla added to the Table 1 list')).toBeDefined();
    expect(onApproved).toHaveBeenCalledWith('r1');
  });

  it('declines a join, which takes the request off', async () => {
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Decline Ritika Bhalla' }));
    await waitFor(() => expect(calls).toContainEqual({ rpc: 'leave_waitlist', body: { p_entry_id: 'r1' } }));
    expect(await screen.findByText('Ritika Bhalla’s request declined')).toBeDefined();
  });
});

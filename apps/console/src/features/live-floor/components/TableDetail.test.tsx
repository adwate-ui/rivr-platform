import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, type FloorTable, type SeatedPlayer } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TableDetail } from './TableDetail.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const TABLE: FloorTable = {
  id: 't3', venueId: 'v1', name: 'Table 3', room: 'main', seats: 9, tableTypeId: 'tt', tableTypeName: 'NLH 100/200', smallBlind: 10000n, bigBlind: 20000n,
  buyIn: 1000000n, straddle: null, waiting: 0, callTimeMinutes: 180, openSeats: null, mustMoveToTableId: null, isOpen: true,
};
const KABIR: SeatedPlayer = {
  sessionId: 's1', tableId: 't3', seat: 5, memberId: 'm1', fullName: 'Kabir Sethi', tierName: 'Gold', startedAt: '2026-11-15T15:00:00Z',
  mustMoveOrder: null, isAway: false, callTimeLeft: null, leavingAt: null, topUp: null,
};

const PRIYA: SeatedPlayer = { ...KABIR, sessionId: 's2', seat: 6, memberId: 'm2', fullName: 'Priya Nair', callTimeLeft: 1800 };

/** Aditya, who runs the waitlist, at Table 3 with Kabir in seat 5 (or `seats`), and a fake API that keeps each seat ended. */
function renderTable(seats: readonly SeatedPlayer[] = [KABIR], permissions: readonly string[] = ['members.read', 'waitlist.manage'], table = TABLE) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const ended: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/end_seat') || url.includes('/rpc/let_leave_early')) {
      ended.push({ to: url.split('/rpc/')[1], body: JSON.parse(String(init?.body)) });
      return new Response(null, { status: 204 });
    }
    return Response.json([]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TableDetail venueId="v1" table={table} tables={[table]} seats={seats} held={[]} permissions={permissions} night={undefined} />
    </RivrDataProvider>,
  );
  return ended;
}

describe('a table on the live floor', () => {
  it('ends a player\u2019s seat only on the second press of Leave, which says who leaves (F2-32)', async () => {
    const ended = renderTable();
    fireEvent.click(screen.getByRole('button', { name: 'Kabir Sethi leaves' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, Kabir Sethi leaves' }));
    await waitFor(() => expect(ended).toEqual([{ to: 'end_seat', body: { p_session_id: 's1', p_reason: 'left' } }]));
  });

  it('has one Leave: Away, Move and Mark leaving are not on the row (decision 0299)', () => {
    renderTable([KABIR, PRIYA], ['members.read', 'waitlist.manage', 'call_time.override']);
    expect(screen.queryByRole('button', { name: 'Move Kabir Sethi' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Kabir Sethi is away from the table' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark leaving: Kabir Sethi' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Let Priya Nair leave early' })).toBeNull();
    expect(screen.getAllByRole('button', { name: /leaves$/ }).map((button) => button.textContent)).toEqual(['Leave', 'Leave']);
  });

  it('says since when each player plays, and their call time or none (decision 0299)', () => {
    renderTable([KABIR, PRIYA]);
    expect(screen.getAllByText(/^Playing since \d{2}:\d{2}$/)).toHaveLength(2);
    expect(screen.getByText('No call time')).toBeDefined();
    expect(screen.getByText('Call time 30 min left')).toBeDefined();
  });

  it('lets a player who owes call time go early, with a reason, and frees the seat in the same step (decision 0299)', async () => {
    const ended = renderTable([PRIYA], ['members.read', 'waitlist.manage', 'call_time.override']);
    fireEvent.click(screen.getByRole('button', { name: 'Priya Nair leaves' }));
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 3, name: 'Early departure for Priya Nair' }));
    fireEvent.change(screen.getByRole('textbox', { name: /^Why they leave early/ }), { target: { value: 'Feeling unwell' } });
    fireEvent.click(screen.getByRole('button', { name: 'Let leave early' }));
    await waitFor(() => expect(ended).toEqual([
      { to: 'let_leave_early', body: { p_venue_id: 'v1', p_member_id: 'm2', p_reason: 'Feeling unwell' } },
      { to: 'end_seat', body: { p_session_id: 's2', p_reason: 'left' } },
    ]));
  });

  it('shows a role that does not read members the table without its night, which it would read as noughts (F2-25)', () => {
    render(
      <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
        queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <TableDetail venueId="v1" table={TABLE} tables={[TABLE]} seats={[]} held={[]} permissions={['dashboards.read']} night={undefined} />
      </RivrDataProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Table 3' })).toBeDefined();
    expect(screen.queryByText('No dealer')).toBeNull();
    expect(screen.queryByText('Call time running')).toBeNull();
  });

  it('counts who at the table still owes call time and who asks for a top-up, where hands used to be (A-11)', () => {
    renderTable([KABIR, PRIYA, { ...KABIR, sessionId: 's3', seat: 7, memberId: 'm3', fullName: 'Arjun Mehta', topUp: 'requested' }]);
    const counts = (label: string) => screen.getByText(label).parentElement?.textContent;
    expect(counts('Call time running')).toBe('Call time running1');
    expect(counts('Top-ups waiting')).toBe('Top-ups waiting1');
    expect(screen.queryByText('Hands')).toBeNull();
    expect(screen.queryByText('Per hour')).toBeNull();
  });

  it('says Empty for a free seat at a closed table, not Open (C-08)', () => {
    renderTable([], ['members.read', 'waitlist.manage'], { ...TABLE, isOpen: false });
    expect(screen.getAllByText('Empty')).toHaveLength(9);
    expect(screen.queryByText('Open')).toBeNull();
  });


  it('sends a member whose identity check is not finished to the front desk (C-08)', async () => {
    renderTable([], ['members.read', 'waitlist.manage']);
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = String(input instanceof Request ? input.url : input);
      return url.includes('/rpc/seat_member') ? Response.json({ code: 'RVKYC', message: 'kyc' }, { status: 400 }) : Response.json([]);
    });
    fireEvent.click(screen.getByRole('button', { name: '4' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Mobile or member number' }), { target: { value: '9000000202' } });
    fireEvent.click(screen.getByRole('button', { name: 'Seat' }));
    const refusal = await screen.findByRole('alert', {}, { timeout: 5000 });
    expect(refusal.textContent).toContain('This member has not finished their identity check. Send them to the front desk.');
  });

  it('shows a seat refused beside the seat form, not above the seats (F2-29)', async () => {
    renderTable([], ['members.read', 'waitlist.manage']);
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = String(input instanceof Request ? input.url : input);
      return url.includes('/rpc/seat_member') ? Response.json({ code: 'RVOCC', message: 'taken' }, { status: 400 }) : Response.json([]);
    });
    fireEvent.click(screen.getByRole('button', { name: '4' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Mobile or member number' }), { target: { value: '9000000211' } });
    fireEvent.click(screen.getByRole('button', { name: 'Seat' }));
    const refusal = await screen.findByRole('alert', {}, { timeout: 5000 });
    const form = screen.getByRole('heading', { level: 3, name: 'Seat a player' });
    expect(form.compareDocumentPosition(refusal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

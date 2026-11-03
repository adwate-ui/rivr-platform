import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, type WaitlistBoardEntry } from '@rivr/db';
import { ToastProvider } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BulkPlaces } from './BulkPlaces.tsx';

const place = (place: number, fullName: string): WaitlistBoardEntry => ({
  entryId: `e${String(place)}`, tableTypeId: 'tt', memberId: `m${String(place)}`, fullName, joinedAt: '2026-11-15T15:35:00Z', place, addedByFloor: false,
  priorityReason: null, callTableName: null, callSeat: null, holdUntil: null, awayUntil: null, tableId: 't1', onWayAt: null,
});

let calls: { rpc: string; body: unknown }[] = [];

beforeEach(() => {
  calls = [];
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const rpc = String(input instanceof Request ? input.url : input).split('/rpc/')[1];
    if (rpc !== undefined) calls.push({ rpc, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return Response.json(rpc === undefined ? [] : null);
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

function renderBar(onClear = vi.fn()) {
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider place="console"><BulkPlaces venueId="v1" entries={[place(1, 'Ishaan Verma'), place(2, 'Mihir Shah')]} onClear={onClear} /></ToastProvider>
    </RivrDataProvider>,
  );
  return onClear;
}

describe('the bulk bar over the places ticked (console v3)', () => {
  it('holds every place ticked, says how many, and clears the ticks', async () => {
    const onClear = renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'Hold' }));
    await waitFor(() => expect(calls.map((call) => call.body)).toEqual([{ p_entry_id: 'e1', p_is_away: true }, { p_entry_id: 'e2', p_is_away: true }]));
    expect(await screen.findByText('Places held: 2')).toBeDefined();
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('asks before removing every place ticked', async () => {
    renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.getByText('Remove the places ticked: 2?')).toBeDefined();
    expect(calls).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove them' }));
    await waitFor(() => expect(calls).toEqual([
      { rpc: 'leave_waitlist', body: { p_entry_id: 'e1' } }, { rpc: 'leave_waitlist', body: { p_entry_id: 'e2' } },
    ]));
    expect(await screen.findByText('Removed from the lists: 2')).toBeDefined();
  });
});

import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemberVisits, type EditVisitPanel } from './MemberVisits.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const TABLE = { id: 't5', venue_id: 'v1', name: 'Table 5', is_open: true, seats: 9, position: 5, table_type_id: 'tt1', must_move_to_table_id: null, room: 'main', min_buy_in_paise: 1000000 };
const TYPE = { id: 'tt1', name: 'NLH 50/100', game: 'nlh', small_blind_paise: 5000, big_blind_paise: 10000, straddle_paise: null };
const VISIT = {
  visit_id: 'vis1', opened_at: '2026-11-20T14:30:00Z', closed_at: '2026-11-20T18:00:00Z', tables: 'Table 5', minutes_played: 210, call_time_met: null,
  left_early: false, leave_reasons: [],
  sessions: [{ id: 's1', table: 'Table 5', startedAt: '2026-11-20T14:30:00Z', endedAt: '2026-11-20T18:00:00Z', awaySeconds: 0 }],
};

/** Kabir's (m1) visits for a staff member, against a fake API that answers add_visit with `added`; each add sent is kept. */
function renderVisits(props: { canAdd?: boolean; edit?: EditVisitPanel; added?: string; requests?: unknown[]; sessions?: boolean } = {}) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const sent: unknown[] = [];
  // The reads by path; add_visit keeps what it was sent.
  const reads: Record<string, unknown> = {
    '/rpc/member_visits': [{ ...VISIT, sessions: props.sessions === false ? null : VISIT.sessions }], '/rpc/member_visit_requests': props.requests ?? [],
    '/rest/v1/game_table': [TABLE], '/rest/v1/table_type': [TYPE], '/rpc/add_visit': [{ o_status: props.added ?? 'added', o_visit_id: null }],
  };
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/add_visit')) sent.push(JSON.parse(String(init?.body)));
    const path = Object.keys(reads).find((candidate) => url.includes(candidate));
    return Response.json(path === undefined ? [] : reads[path]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemberVisits venueId="v1" memberId="m1" fullName="Kabir Sethi" canAdd={props.canAdd ?? false} edit={props.edit} />
    </RivrDataProvider>,
  );
  return sent;
}

describe('visits added on the record (the owner, 25 Nov)', () => {
  it('adds a past visit with its night, times, table and reason; the floor\'s waits for a super admin', async () => {
    const sent = renderVisits({ canAdd: true, added: 'waiting' });
    fireEvent.click(await screen.findByRole('button', { name: 'Add visit' }));
    const form = screen.getByRole('region', { name: 'Add a past visit' });
    fireEvent.change(within(form).getByLabelText('Club night'), { target: { value: '2026-11-20' } });
    fireEvent.change(within(form).getByLabelText('Check-in'), { target: { value: '20:00' } });
    fireEvent.change(within(form).getByLabelText('Check-out'), { target: { value: '01:30' } });
    fireEvent.click(await within(form).findByRole('radio', { name: 'Table 5' }));
    fireEvent.change(within(form).getByRole('textbox', { name: 'Reason' }), { target: { value: 'Played, not checked in' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save visit' }));
    expect(await screen.findByText('Sent to a super admin to approve.')).toBeDefined();
    expect(sent).toMatchObject([{ p_member_id: 'm1', p_table_id: 't5', p_opened_at: '2026-11-20T14:30:00.000Z', p_closed_at: '2026-11-20T20:00:00.000Z', p_reason: 'Played, not checked in' }]);
  });

  it('keeps what was typed while the form is closed and opened again', async () => {
    renderVisits({ canAdd: true });
    fireEvent.click(await screen.findByRole('button', { name: 'Add visit' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Reason' }), { target: { value: 'Played, not checked in' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add visit' }));
    expect(screen.queryByRole('region', { name: 'Add a past visit' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add visit' }));
    expect(screen.getByRole('textbox', { name: 'Reason' })).toHaveProperty('value', 'Played, not checked in');
  });

  it('refuses a check-out not after the check-in before anything is sent', async () => {
    const sent = renderVisits({ canAdd: true });
    fireEvent.click(await screen.findByRole('button', { name: 'Add visit' }));
    const form = screen.getByRole('region', { name: 'Add a past visit' });
    fireEvent.change(within(form).getByLabelText('Check-in'), { target: { value: '23:00' } });
    fireEvent.change(within(form).getByLabelText('Check-out'), { target: { value: '22:00' } });
    fireEvent.change(within(form).getByRole('textbox', { name: 'Reason' }), { target: { value: 'Played, not checked in' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save visit' }));
    expect(await screen.findByText('Check-out must be after check-in.')).toBeDefined();
    expect(sent).toEqual([]);
  });

  it('shows adds waiting or refused, and offers no Add to staff who may not add', async () => {
    renderVisits({ canAdd: true, requests: [
      { request_id: 'r1', table_name: 'Table 5', opened_at: '2026-11-21T14:30:00Z', closed_at: '2026-11-21T17:30:00Z', status: 'waiting', refusal: null, requested_at: '2026-11-22T10:00:00Z' },
      { request_id: 'r2', table_name: 'Table 2', opened_at: '2026-11-19T14:30:00Z', closed_at: '2026-11-19T17:30:00Z', status: 'refused', refusal: 'Not here', requested_at: '2026-11-20T10:00:00Z' },
    ] });
    expect(await screen.findByText(/· Table 5 · Waiting for approval$/)).toBeDefined();
    expect(screen.getByText(/· Table 2 · Refused: Not here$/)).toBeDefined();
    cleanup();
    renderVisits();
    await screen.findByText('Visit history');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Add visit' })).toBeNull());
  });

  it('opens Edit on a visit for a super admin, with its seats', async () => {
    const edit = vi.fn((_props: { memberId: string; visits: readonly unknown[] }) => null);
    renderVisits({ edit });
    fireEvent.click(await screen.findByRole('button', { name: /^Edit the visit of / }));
    await waitFor(() => expect(edit).toHaveBeenCalled());
    expect(edit.mock.calls[0]?.[0]).toMatchObject({ memberId: 'm1', visits: [{ visitId: 'vis1', sessions: [{ sessionId: 's1', tableName: 'Table 5' }] }] });
    cleanup();
    renderVisits({ edit, sessions: false });
    await screen.findByText('Visit history');
    expect(screen.queryByRole('button', { name: /^Edit the visit of / })).toBeNull();
  });
});

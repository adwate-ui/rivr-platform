import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, StaffVenueProvider } from '@rivr/db';
import { ToastProvider } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemberBonus } from './MemberBonus.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** What the record's reads answer: its history, its balance in paise, and the seats a missed use may go to. */
interface Answers {
  readonly history?: readonly unknown[];
  readonly balance?: number;
  readonly seats?: readonly unknown[];
}

/** How many rows a read asked for: its body's `p_limit`. */
const limitOf = (body: unknown) => (typeof body === 'object' && body !== null && 'p_limit' in body ? Number(body.p_limit) : 0);

/**
 * The record's Bonus part for member m1, for a staff member who may (`canGive`) or may not add Bonus by hand, and who is a
 * super admin (`canCorrect`) or not; `sent` keeps each call and what it sent.
 */
function renderPart(canGive: boolean, canCorrect = false, answers: Answers = {}) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const sent: { path: string; body: unknown }[] = [];
  const replies: Readonly<Record<string, unknown>> = {
    member_bonus_history: answers.history ?? [],
    member_bonus: answers.balance === undefined ? [] : [{ bonus_paise: answers.balance }],
    reverse_bonus: 200_000,
    add_bonus_use: null,
  };
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const path = url.includes('/rpc/') ? url.replace(/^.*\/rpc\//, '').replace(/\?.*$/, '') : '';
    const body: unknown = JSON.parse(String(init?.body ?? 'null'));
    sent.push({ path, body });
    // The seats a page at a time, as the server reads them.
    if (path === 'bonus_use_seats') return Response.json((answers.seats ?? []).slice(0, limitOf(body)));
    return Response.json(path in replies ? replies[path] : []);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider place="console">
        <StaffVenueProvider><MemberBonus venueId="v1" memberId="m1" canGive={canGive} canCorrect={canCorrect} /></StaffVenueProvider>
      </ToastProvider>
    </RivrDataProvider>,
  );
  return { sent };
}

/**
 * As member_bonus_history gives it: a use added after the fact; a ₹2,000 welcome given; ₹500 for a birthday, reversed by
 * Vikram; ₹300 that all expired; ₹1,000 of which ₹400 expired. A grant's later lines carry its id.
 */
const HISTORY = [
  { line_id: 'r1', at: '2026-11-18T09:00:00Z', kind: 'redeemed', amount_paise: 50_000, reason: 'Missed at the seat', table_name: 'Table 5', staff_name: 'Vikram Rao' },
  { line_id: 'g2', at: '2026-11-18T08:00:00Z', kind: 'reversed', amount_paise: 50_000, reason: 'Wrong member', table_name: null, staff_name: 'Vikram Rao' },
  { line_id: 'g3', at: '2026-11-18T07:00:00Z', kind: 'expired', amount_paise: 30_000, reason: 'Old offer', table_name: null, staff_name: null },
  { line_id: 'g4', at: '2026-11-18T06:00:00Z', kind: 'expired', amount_paise: 40_000, reason: 'Tuesday', table_name: null, staff_name: null },
  { line_id: 'g1', at: '2026-11-17T08:00:00Z', kind: 'credited', amount_paise: 200_000, reason: 'Welcome bonus', table_name: null, staff_name: null },
  { line_id: 'g2', at: '2026-11-16T08:00:00Z', kind: 'credited', amount_paise: 50_000, reason: 'Birthday', table_name: null, staff_name: null },
  { line_id: 'g3', at: '2026-11-15T08:00:00Z', kind: 'credited', amount_paise: 30_000, reason: 'Old offer', table_name: null, staff_name: null },
  { line_id: 'g4', at: '2026-11-14T08:00:00Z', kind: 'credited', amount_paise: 100_000, reason: 'Tuesday', table_name: null, staff_name: null },
];
const SEAT = { session_id: 's7', table_name: 'Table 5', seat: 7, started_at: '2026-11-18T16:40:00Z', ended_at: '2026-11-18T19:40:00Z' };

describe('MemberBonus: Bonus by hand on the record (redesign of 15 Nov)', () => {
  it('offers the form to staff who may add Bonus by hand, above the history', async () => {
    renderPart(true);
    const add = await screen.findByRole('button', { name: 'Add Bonus' });
    const history = screen.getByRole('heading', { name: 'Bonus history' });
    expect(add.compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows other staff the balances and the history only', async () => {
    renderPart(false, false, { history: HISTORY });
    expect(await screen.findByText(/Welcome bonus/)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Add Bonus' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Welcome bonus/ })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Missed Bonus use' })).toBeNull();
  });
});

describe('MemberBonus: a super admin reverses Bonus and adds a missed use (the owner, 18 Nov)', () => {
  it('reverses a Bonus given from its row, with a reason; nothing on one reversed or all expired', async () => {
    const { sent } = renderPart(false, true, { history: HISTORY });
    expect(await screen.findByText('18 Nov 2026 · Reversed · Wrong member · by Vikram Rao')).toBeDefined();
    expect(screen.queryByRole('button', { name: /Birthday/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Old offer/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Welcome bonus.*Reverse$/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Reverse Bonus' });
    fireEvent.change(within(sheet).getByLabelText('Reason'), { target: { value: 'Given to the wrong member' } });
    // One press: the sheet with its reason is the second ask, so the footer holds Cancel and Reverse alone.
    expect(within(sheet).getAllByRole('button', { name: 'Cancel' })).toHaveLength(1);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Reverse' }));
    await waitFor(() => expect(sent.filter((call) => call.path === 'reverse_bonus').map((call) => call.body))
      .toEqual([{ p_grant_id: 'g1', p_reason: 'Given to the wrong member' }]));
    expect(await screen.findByText('2,000 Bonus reversed.')).toBeDefined();
  });

  it('says what of a Bonus given expired, and that a use added after the fact was added, by whom and why', async () => {
    renderPart(false, true, { history: HISTORY });
    expect(await screen.findByText('18 Nov 2026 · Buy-in · Table 5 · Missed at the seat · added by Vikram Rao')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /Tuesday.*Reverse$/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Reverse Bonus' });
    expect(within(sheet).getByText('400 of it expired.')).toBeDefined();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Reverse Bonus' })).toBeNull();
  });

  it('adds a use a seat missed: any seat past its Undo, whole fifties and a reason', async () => {
    const { sent } = renderPart(false, true, { seats: [SEAT] });
    fireEvent.click(await screen.findByRole('radio', { name: /^Table 5 · seat 7 · / }));
    fireEvent.change(screen.getByLabelText('Bonus used'), { target: { value: '1,500' } });
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Missed at the seat' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add use' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, take 1,500 Bonus' }));
    await waitFor(() => expect(sent.filter((call) => call.path === 'add_bonus_use').map((call) => call.body))
      .toEqual([expect.objectContaining({ p_session_id: 's7', p_chips: 1500, p_reason: 'Missed at the seat' })]));
    expect(await screen.findByText('1,500 Bonus use added.')).toBeDefined();
  });

  it('says when no seat is there to add a use to', async () => {
    renderPart(false, true);
    expect(await screen.findByText('No seats to add a use to.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Add use' }).getAttribute('aria-disabled') === 'true'
      || screen.getByRole('button', { name: 'Add use' }).hasAttribute('disabled')).toBe(true);
  });

  it('offers any seat, ten at a time, the newest first', async () => {
    const seats = Array.from({ length: 12 }, (_, index) => ({ ...SEAT, session_id: `s${String(index)}`, seat: index + 1 }));
    renderPart(false, true, { seats });
    expect(await screen.findAllByRole('radio', { name: /^Table 5 · seat / })).toHaveLength(10);
    fireEvent.click(screen.getByRole('button', { name: 'Show earlier' }));
    expect(await screen.findAllByRole('radio', { name: /^Table 5 · seat 1[12]/ })).toHaveLength(2);
    expect(screen.getAllByRole('radio', { name: /^Table 5 · seat / })).toHaveLength(12);
    expect(screen.queryByRole('button', { name: 'Show earlier' })).toBeNull();
  });

  it('shows a balance below zero as owed', async () => {
    renderPart(false, false, { balance: -50_000 });
    expect(await screen.findByText('−500')).toBeDefined();
    expect(screen.getByText('Owed. New Bonus pays it first.')).toBeDefined();
  });
});

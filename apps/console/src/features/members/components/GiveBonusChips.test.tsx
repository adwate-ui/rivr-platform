import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, StaffVenueProvider } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { chipsFrom, GiveBonusChips } from './GiveBonusChips.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/**
 * The form for member m1, signed in as staff below a super admin, with the API answering give_bonus_chips with `reply`
 * and the club's cap on one addition as `cap` (none unless given); what it is sent is kept.
 */
function renderForm(reply: { status: number; body: unknown } = { status: 200, body: 'g1' }, cap: number | null = null) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const sent: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rest/v1/setting?')) return Response.json(cap === null ? [] : [{ value: { chips: cap } }]);
    if (!url.includes('/rpc/give_bonus_chips')) return Response.json([]);
    sent.push(JSON.parse(String(init?.body)));
    return Response.json(reply.body, { status: reply.status });
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StaffVenueProvider><GiveBonusChips venueId="v1" memberId="m1" /></StaffVenueProvider>
    </RivrDataProvider>,
  );
  return { sent };
}

/** Types the chips and the reason, then presses Add and its confirmation. */
function addChips(chips: string, reason: string) {
  fireEvent.change(screen.getByRole('textbox', { name: /^Bonus/ }), { target: { value: chips } });
  fireEvent.change(screen.getByRole('textbox', { name: /^Reason/ }), { target: { value: reason } });
  fireEvent.click(screen.getByRole('button', { name: 'Add Bonus' }));
}

describe('chipsFrom', () => {
  it('takes whole fifties from 50 to 1,00,000, commas allowed, and nothing else', () => {
    expect(chipsFrom('50')).toBe(50);
    expect(chipsFrom('1,500')).toBe(1500);
    expect(chipsFrom('100000')).toBe(100_000);
    for (const typed of ['', '0', '25', '75', '100050', '12.5', '-50', 'abc']) expect(chipsFrom(typed)).toBeNull();
  });
});

describe('GiveBonusChips', () => {
  it('says when the staff member has reached their daily limit (the owner, 9 Nov)', async () => {
    renderForm({ status: 200, body: null });
    addChips('500', 'Birthday at the club');
    fireEvent.click(screen.getByRole('button', { name: 'Yes, add 500 Bonus' }));
    expect(await screen.findByText('Past your daily limit for adding Bonus. A super admin can add more.')).toBeDefined();
  });

  it('adds Bonus with a reason after a second press, and says so (owner, 8 Nov)', async () => {
    const { sent } = renderForm();
    expect(screen.getByRole('button', { name: 'Add Bonus' }).hasAttribute('disabled')).toBe(true);
    addChips('1,500', 'Birthday at the club');
    fireEvent.click(screen.getByRole('button', { name: 'Yes, add 1,500 Bonus' }));
    expect(await screen.findByText('1,500 Bonus added.')).toBeDefined();
    expect(sent).toEqual([{ p_member_id: 'm1', p_chips: 1500, p_reason: 'Birthday at the club', p_request_id: expect.any(String) }]);
    expect(screen.getByRole('textbox', { name: /^Bonus/ })).toHaveProperty('value', '');
  });

  it('says why their own record is refused, and keeps what was typed', async () => {
    renderForm({ status: 400, body: { code: 'RVOWN', message: 'own', details: null, hint: null } });
    addChips('500', 'For me');
    fireEvent.click(screen.getByRole('button', { name: 'Yes, add 500 Bonus' }));
    expect(await screen.findByText('Not to yourself. Ask someone else who can.')).toBeDefined();
    expect(screen.getByRole('textbox', { name: /^Bonus/ })).toHaveProperty('value', '500');
  });

  it('says the most this person adds at once under the field, and offers no Add above it (redesign RD-19)', async () => {
    renderForm(undefined, 5000);
    expect(screen.getByText('Whole fifties, 50 to 1,00,000.')).toBeDefined();
    expect(await screen.findByText('Whole fifties, 50 to 5,000.')).toBeDefined();
    fireEvent.change(screen.getByRole('textbox', { name: /^Bonus/ }), { target: { value: '5,050' } });
    fireEvent.change(screen.getByRole('textbox', { name: /^Reason/ }), { target: { value: 'High hand night' } });
    expect(screen.getByRole('button', { name: 'Add Bonus' }).hasAttribute('disabled')).toBe(true);
    fireEvent.change(screen.getByRole('textbox', { name: /^Bonus/ }), { target: { value: '5,000' } });
    expect(screen.getByRole('button', { name: 'Add Bonus' }).hasAttribute('disabled')).toBe(false);
  });

  it('says when the database refuses an amount above the cap, set since the form was drawn, and keeps it to type less', async () => {
    renderForm({ status: 400, body: { code: 'RVCAP', message: 'cap', details: null, hint: null } });
    addChips('5,050', 'High hand night');
    fireEvent.click(screen.getByRole('button', { name: 'Yes, add 5,050 Bonus' }));
    expect(await screen.findByText('More than staff add at once. Type less, or ask a super admin.')).toBeDefined();
    expect(screen.getByRole('textbox', { name: /^Bonus/ })).toHaveProperty('value', '5,050');
  });
});

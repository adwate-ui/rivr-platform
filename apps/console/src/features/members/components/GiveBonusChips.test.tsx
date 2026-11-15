import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { chipsFrom, GiveBonusChips } from './GiveBonusChips.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** The form for member m1, signed in, with the API answering give_bonus_chips with `reply`; what it is sent is kept. */
function renderForm(reply: { status: number; body: unknown } = { status: 200, body: 'g1' }) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const sent: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.includes('/rpc/give_bonus_chips')) return Response.json([]);
    sent.push(JSON.parse(String(init?.body)));
    return Response.json(reply.body, { status: reply.status });
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <GiveBonusChips venueId="v1" memberId="m1" />
    </RivrDataProvider>,
  );
  return { sent };
}

/** Types the chips and the reason, then presses Add and its confirmation. */
function addChips(chips: string, reason: string) {
  fireEvent.change(screen.getByRole('textbox', { name: /^Bonus chips/ }), { target: { value: chips } });
  fireEvent.change(screen.getByRole('textbox', { name: /^Reason/ }), { target: { value: reason } });
  fireEvent.click(screen.getByRole('button', { name: 'Add bonus chips' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Yes, add 500 bonus chips' }));
    expect(await screen.findByText('Past your daily limit for adding bonus chips. A super admin can add more.')).toBeDefined();
  });

  it('adds bonus chips with a reason after a second press, and says so (owner, 8 Nov)', async () => {
    const { sent } = renderForm();
    expect(screen.getByRole('button', { name: 'Add bonus chips' }).hasAttribute('disabled')).toBe(true);
    addChips('1,500', 'Birthday at the club');
    fireEvent.click(screen.getByRole('button', { name: 'Yes, add 1,500 bonus chips' }));
    expect(await screen.findByText('1,500 bonus chips added.')).toBeDefined();
    expect(sent).toEqual([{ p_member_id: 'm1', p_chips: 1500, p_reason: 'Birthday at the club', p_request_id: expect.any(String) }]);
    expect(screen.getByRole('textbox', { name: /^Bonus chips/ })).toHaveProperty('value', '');
  });

  it('says why their own record is refused, and keeps what was typed', async () => {
    renderForm({ status: 400, body: { code: 'RVOWN', message: 'own', details: null, hint: null } });
    addChips('500', 'For me');
    fireEvent.click(screen.getByRole('button', { name: 'Yes, add 500 bonus chips' }));
    expect(await screen.findByText('Not to yourself. Ask someone else who can.')).toBeDefined();
    expect(screen.getByRole('textbox', { name: /^Bonus chips/ })).toHaveProperty('value', '500');
  });
});

import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UseBonus } from './UseBonus.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** The form for member m1, with the API answering use_bonus with `reply`; what it is sent is kept. */
function renderForm(reply: { status: number; body: unknown } = { status: 200, body: 'u1' }) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const sent: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.includes('/rpc/use_bonus')) return Response.json([]);
    sent.push(JSON.parse(String(init?.body)));
    return Response.json(reply.body, { status: reply.status });
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <UseBonus venueId="v1" memberId="m1" />
    </RivrDataProvider>,
  );
  return { sent };
}

const chipsField = () => screen.getByRole('textbox', { name: /^Bonus/ });
const reasonField = () => screen.getByRole('textbox', { name: /^Reason/ });

/** Types the chips and the reason, then presses Use Bonus and its confirmation. */
function useChips(chips: string, reason: string) {
  fireEvent.change(chipsField(), { target: { value: chips } });
  fireEvent.change(reasonField(), { target: { value: reason } });
  fireEvent.click(screen.getByRole('button', { name: 'Use Bonus' }));
  fireEvent.click(screen.getByRole('button', { name: `Yes, use ${chips} Bonus` }));
}

/** A refusal from the server with `code`. */
const refusal = (code: string) => ({ status: 400, body: { code, message: 'no', details: null, hint: null } });

/** The request id each call sent. */
const requestIdsOf = (sent: readonly unknown[]) => sent.map((body) => (typeof body === 'object' && body !== null && 'p_request_id' in body ? body.p_request_id : null));

describe('UseBonus (the owner, 20 Nov)', () => {
  it('uses Bonus with a reason after a second press, says so, and clears the form', async () => {
    const { sent } = renderForm();
    expect(screen.getByRole('button', { name: 'Use Bonus' }).hasAttribute('disabled')).toBe(true);
    useChips('1,500', 'Chips for the cash game');
    expect(await screen.findByText('1,500 Bonus used.')).toBeDefined();
    expect(sent).toEqual([{ p_member_id: 'm1', p_chips: 1500, p_reason: 'Chips for the cash game', p_request_id: expect.any(String) }]);
    expect(chipsField()).toHaveProperty('value', '');
  });

  it('offers no Use below a whole fifty or without a reason', () => {
    renderForm();
    fireEvent.change(chipsField(), { target: { value: '75' } });
    fireEvent.change(reasonField(), { target: { value: 'Chips for the bar' } });
    expect(screen.getByRole('button', { name: 'Use Bonus' }).hasAttribute('disabled')).toBe(true);
    fireEvent.change(chipsField(), { target: { value: '100' } });
    fireEvent.change(reasonField(), { target: { value: 'ok' } });
    expect(screen.getByRole('button', { name: 'Use Bonus' }).hasAttribute('disabled')).toBe(true);
  });

  it('says a refusal about the amount under it, and keeps what was typed', async () => {
    renderForm(refusal('RVVCP'));
    useChips('500', 'Chips for the cash game');
    expect(await screen.findByText('More than this visit allows. Type less.')).toBeDefined();
    expect(chipsField().getAttribute('aria-invalid')).toBe('true');
    expect(reasonField().getAttribute('aria-invalid')).toBeNull();
    expect(chipsField()).toHaveProperty('value', '500');
    // Typing again takes the refusal away.
    fireEvent.change(chipsField(), { target: { value: '450' } });
    expect(screen.queryByText('More than this visit allows. Type less.')).toBeNull();
  });

  it('says more than they hold under the amount, and a short reason under the reason', async () => {
    renderForm(refusal('RVBON'));
    useChips('500', 'Chips for the cash game');
    expect(await screen.findByText('More than their Bonus. Type less.')).toBeDefined();
    cleanup();
    renderForm(refusal('22023'));
    useChips('500', 'Chips for the cash game');
    expect(await screen.findByText('Give a reason of 3 to 200 characters.')).toBeDefined();
    expect(reasonField().getAttribute('aria-invalid')).toBe('true');
  });

  it('says when it is their own record, and a refusal is final for that press', async () => {
    const { sent } = renderForm(refusal('RVOWN'));
    useChips('500', 'Chips for the cash game');
    expect(await screen.findByText('Not on your own record. Ask someone else who can.')).toBeDefined();
    expect(chipsField().getAttribute('aria-invalid')).toBeNull();
    // A refusal is final for that press: pressing again is a new request.
    fireEvent.click(screen.getByRole('button', { name: 'Use Bonus' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, use 500 Bonus' }));
    await vi.waitFor(() => expect(sent).toHaveLength(2));
    const [first, second] = requestIdsOf(sent);
    expect(first).toEqual(expect.any(String));
    expect(first).not.toBe(second);
  });

  it('keeps the request id when the line dropped, so pressing again never uses twice', async () => {
    const { sent } = renderForm(refusal('XX000'));
    useChips('500', 'Chips for the cash game');
    expect(await screen.findByText('Not used. Try again.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Use Bonus' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, use 500 Bonus' }));
    await vi.waitFor(() => expect(sent).toHaveLength(2));
    const [first, second] = requestIdsOf(sent);
    expect(first).toEqual(expect.any(String));
    expect(first).toBe(second);
  });
});

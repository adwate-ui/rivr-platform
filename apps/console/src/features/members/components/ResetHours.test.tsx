import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResetHours } from './ResetHours.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** Vikram, a super admin, signed in, and a fake API that keeps each reset sent and answers with `refusal` when given one. */
function renderReset(refusal: string | null = null) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const sent: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.includes('/rpc/reset_member_hours')) return Response.json([]);
    sent.push(JSON.parse(String(init?.body)));
    return refusal === null ? Response.json('2026-11-15T18:00:00+00:00') : Response.json({ code: refusal, message: 'no' }, { status: 400 });
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })} queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ResetHours venueId="v1" memberId="m1" name="Ishaan Verma" />
    </RivrDataProvider>,
  );
  return sent;
}

const reason = () => screen.getByRole('textbox', { name: 'Why they are reset' });

describe('resetting one member’s hours on their record (redesign RD-36)', () => {
  it('asks for a reason before Reset hours can be pressed', () => {
    renderReset();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Reset hours' }).disabled).toBe(true);
    fireEvent.change(reason(), { target: { value: 'ok' } });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Reset hours' }).disabled).toBe(true);
    fireEvent.change(reason(), { target: { value: 'A new season' } });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Reset hours' }).disabled).toBe(false);
  });

  it('resets them only on the second press, naming the member, and says so', async () => {
    const sent = renderReset();
    fireEvent.change(reason(), { target: { value: ' A new season ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset hours' }));
    expect(sent).toEqual([]);
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, reset the hours of Ishaan Verma' }));
    await waitFor(() => expect(sent).toEqual([{ p_member_id: 'm1', p_reason: 'A new season', p_request_id: expect.any(String) }]));
    expect(await screen.findByText('Hours reset.')).toBeDefined();
    expect(reason()).toHaveProperty('value', '');
  });

  it('says why when the database refuses, and keeps the reason typed', async () => {
    renderReset('42501');
    fireEvent.change(reason(), { target: { value: 'A new season' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset hours' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, reset the hours of Ishaan Verma' }));
    expect(await screen.findByText('Only a super admin resets hours.')).toBeDefined();
    expect(reason()).toHaveProperty('value', 'A new season');
  });
});

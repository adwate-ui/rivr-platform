import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemberBreak } from './MemberBreak.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** A membership manager signed in, and a fake API that keeps each break sent and answers with `answer`. */
function renderBreak(answer: Response) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const sent: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/set_member_break')) {
      sent.push(JSON.parse(String(init?.body)));
      return answer.clone();
    }
    return Response.json([]);
  });
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })} queryClient={cache}>
      <MemberBreak venueId="v1" memberId="m1" />
    </RivrDataProvider>,
  );
  return sent;
}

describe('MemberBreak', () => {
  it('takes a length and a reason of three or more characters, starts the break only on the second press, and says when it ends (A5-14)', async () => {
    const sent = renderBreak(Response.json('2026-12-01T18:30:00+00:00'));
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Start break' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: '30 days' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Why the break' }), { target: { value: 'ab' } });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Start break' }).disabled).toBe(true);
    fireEvent.change(screen.getByRole('textbox', { name: 'Why the break' }), { target: { value: 'Asked at the desk' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start break' }));
    expect(sent).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, start a break of 30 days' }));
    await waitFor(() => expect(sent).toEqual([{ p_member_id: 'm1', p_days: 30, p_reason: 'Asked at the desk' }]));
    expect((await screen.findByRole('status')).textContent).toBe('On a break until 2 Dec 2026, 00:00.');
  });

  it('says why a break is refused', async () => {
    renderBreak(Response.json({ code: '42501', message: 'no' }, { status: 403 }));
    fireEvent.click(screen.getByRole('radio', { name: '7 days' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Why the break' }), { target: { value: 'Asked at the desk' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start break' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, start a break of 7 days' }));
    expect(await screen.findByText('Not in your role. Ask a membership manager.')).toBeDefined();
  });
});

import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChangePhone } from './ChangePhone.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** Vikram, a super admin, signed in, and a fake API that keeps each phone change sent. */
function renderChange() {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const sent: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/change_member_phone')) {
      sent.push(JSON.parse(String(init?.body)));
      return new Response(null, { status: 204 });
    }
    return Response.json([]);
  });
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })} queryClient={cache}>
      <ChangePhone venueId="v1" memberId="m1" currentPhone="+919000000781" />
    </RivrDataProvider>,
  );
  return sent;
}

describe('ChangePhone', () => {
  it('shows the number now, takes the new one twice, and changes it only on the second press', async () => {
    const sent = renderChange();
    expect(screen.getByText('Number now: +91 90000 00781')).toBeDefined();
    fireEvent.change(screen.getByRole('textbox', { name: 'New mobile number' }), { target: { value: '+919000000782' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Type the new number again' }), { target: { value: '+919000000783' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Why it changes' }), { target: { value: 'Lost his phone' } });
    expect(screen.getByText('The two numbers are not the same.')).toBeDefined();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Change number' }).disabled).toBe(true);
    fireEvent.change(screen.getByRole('textbox', { name: 'Type the new number again' }), { target: { value: '+919000000782' } });
    fireEvent.click(screen.getByRole('button', { name: 'Change number' }));
    expect(sent).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, change it to +919000000782' }));
    await waitFor(() => expect(sent).toEqual([{ p_member_id: 'm1', p_phone: '+919000000782', p_reason: 'Lost his phone' }]));
    expect(await screen.findByText('Changed.')).toBeDefined();
  });
});

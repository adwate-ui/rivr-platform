import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NoticesSection } from './NoticesSection.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const VENUE = '00000000-0000-4000-8000-000000000001';

/** Signed in as a super admin, with the launch notice up; every call is kept with what it sent. */
function renderNotices(postReply: { status: number; body: unknown } = { status: 200, body: 'n2' }) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000102', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const calls: { url: string; body: unknown }[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (url.includes('/rpc/venue_notices')) {
      return Response.json([{ notice_id: 'n1', body: 'We\'re launching soon.', starts_at: '2026-11-02T10:00:00+00:00', ends_at: null }]);
    }
    if (url.includes('/rpc/post_notice')) return Response.json(postReply.body, { status: postReply.status });
    return Response.json(null);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <NoticesSection venueId={VENUE} />
    </RivrDataProvider>,
  );
  return calls;
}

describe('notices on Home, in Settings', () => {
  it('lists the notice up, puts up a new one and ends one', async () => {
    const calls = renderNotices();
    expect(await screen.findByText('We\'re launching soon.')).toBeDefined();
    expect(screen.getByText('Until ended')).toBeDefined();

    fireEvent.change(screen.getByRole('textbox', { name: 'Notice' }), { target: { value: 'Open till 4 tonight.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Put up' }));
    expect(await screen.findByText('Notice put up.')).toBeDefined();
    expect(calls.find((call) => call.url.includes('/rpc/post_notice'))?.body).toEqual({ p_venue_id: VENUE, p_body: 'Open till 4 tonight.' });

    fireEvent.click(screen.getByRole('button', { name: 'End the notice: We\'re launching soon.' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, end it' }));
    await waitFor(() => expect(calls.find((call) => call.url.includes('/rpc/end_notice'))?.body).toEqual({ p_notice_id: 'n1' }));
    expect(await screen.findByText('Notice ended.')).toBeDefined();
  });

  it('shows the notice as members’ Home will, while it is typed', async () => {
    renderNotices();
    const preview = (await screen.findByText('On members’ Home')).parentElement;
    expect(within(preview ?? document.body).getByRole('status').textContent).toBe('Your notice shows here.');
    fireEvent.change(screen.getByRole('textbox', { name: 'Notice' }), { target: { value: 'The Private Room opens at 20:00.' } });
    expect(within(preview ?? document.body).getByRole('status').textContent).toBe('The Private Room opens at 20:00.');
  });

  it('says what to do when the notice is refused', async () => {
    renderNotices({ status: 400, body: { code: '22023', message: 'too long' } });
    fireEvent.change(await screen.findByRole('textbox', { name: 'Notice' }), { target: { value: 'x'.repeat(281) } });
    fireEvent.click(screen.getByRole('button', { name: 'Put up' }));
    expect(await screen.findByText('Write 1 to 280 characters, then put it up.')).toBeDefined();
  });
});

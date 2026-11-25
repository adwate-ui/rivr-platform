import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { ToastProvider } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VisitApprovals } from './VisitApprovals.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const WAITING = {
  request_id: 'r1', member_id: 'm1', member_number: 1042, full_name: 'Ritika Das', table_name: 'Table 5', opened_at: '2026-11-20T14:30:00Z',
  closed_at: '2026-11-20T18:00:00Z', reason: 'Played, not checked in', requested_by: 'Harish Kumar', requested_at: '2026-11-21T10:00:00Z',
};

/** A super admin on the tab, against a fake API with Ritika's visit waiting; each decision sent is kept. */
function renderApprovals(waiting: unknown[] = [WAITING]) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const sent: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/visits_waiting')) return Response.json(waiting);
    if (url.includes('/rpc/decide_visit_request')) {
      sent.push(JSON.parse(String(init?.body)));
      return Response.json(null);
    }
    return Response.json([]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider place="console"><VisitApprovals venueId="v1" /></ToastProvider>
    </RivrDataProvider>,
  );
  return sent;
}

describe('VisitApprovals (the owner, 25 Nov)', () => {
  it('shows each waiting visit with why and who asked, and approves it on the second press', async () => {
    const sent = renderApprovals();
    expect(await screen.findByText(/^Ritika Das · No\. 1042 · .* · Table 5$/)).toBeDefined();
    expect(screen.getByText('Played, not checked in · asked by Harish Kumar')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Approve: Ritika Das' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, approve' }));
    await waitFor(() => expect(sent).toEqual([{ p_request_id: 'r1', p_approve: true }]));
    expect(await screen.findByText('Visit of Ritika Das approved.')).toBeDefined();
  });

  it('refuses one with why, says when the reason is short, and Cancel goes back to the row', async () => {
    const sent = renderApprovals();
    fireEvent.click(await screen.findByRole('button', { name: 'Refuse: Ritika Das' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('button', { name: 'Approve: Ritika Das' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Refuse: Ritika Das' }));
    fireEvent.click(screen.getByRole('button', { name: 'Refuse visit' }));
    expect(await screen.findByText('Give a reason of 3 to 200 characters, on one line.')).toBeDefined();
    fireEvent.change(screen.getByRole('textbox', { name: /^Why it is refused/ }), { target: { value: 'Not at the club that night' } });
    fireEvent.click(screen.getByRole('button', { name: 'Refuse visit' }));
    await waitFor(() => expect(sent).toEqual([{ p_request_id: 'r1', p_approve: false, p_reason: 'Not at the club that night' }]));
  });

  it('says when none waits', async () => {
    renderApprovals([]);
    expect(await screen.findByText('No visits waiting.')).toBeDefined();
  });
});

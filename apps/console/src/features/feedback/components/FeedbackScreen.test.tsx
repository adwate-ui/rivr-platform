import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { ToastProvider } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FeedbackList } from './FeedbackScreen.tsx';

afterEach(() => {
  pageCalls = [];
  resolves = [];
  openRows = OPEN;
  refuseResolve = false;
  resolvedPage = [RESOLVED];
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const ROW = {
  member_id: 'm1', member_number: 42, visit_closed_at: null, score: null, is_ticket: true, resolved_at: null, resolved_by: null,
  resolution: null, created_at: '2026-11-03T06:00:00Z', topic: null, ratings: null, nps: null,
};

/** Two open tickets, one resolved by Vikram Rao, and a good rating that needed nothing. */
const ANHOUR_AGO = new Date(Date.now() - 3_600_000).toISOString();
const OPEN = [
  { ...ROW, id: 'f1', full_name: 'Ritika Bhalla', note: 'Check-in took ten minutes.', topic: 'check_in_out', tables: null, wait_seconds: null },
  { ...ROW, id: 'f2', full_name: 'Rhea Kaul', note: 'Waited for a chai.', topic: 'service', score: 2, created_at: ANHOUR_AGO, visit_closed_at: '2026-11-08T20:00:00Z', tables: 'Table 1, Table 3', wait_seconds: 2400 },
];
const RESOLVED = { ...ROW, id: 'f3', full_name: 'Yuvraj Luthra', note: 'Quick dealer.', resolved_at: '2026-11-03T08:00:00Z', resolved_by: 'Vikram Rao', resolution: 'Thanked him.' };
const OTHER = { ...ROW, id: 'f4', full_name: 'Zoya Merchant', note: null, is_ticket: false, score: 5, visit_closed_at: '2026-11-02T20:00:00Z' };

/** What each read gives; a full page of Resolved has another after it. */
let pageCalls: unknown[] = [];
let resolves: unknown[] = [];
let openRows: unknown[] = OPEN;
let refuseResolve = false;
let resolvedPage: unknown[] = [RESOLVED];

/** Keeps what was sent, and refuses it once when a test asks. */
function resolveResponse(init?: RequestInit) {
  resolves.push(JSON.parse(String(init?.body)));
  if (!refuseResolve) return Response.json([]);
  refuseResolve = false;
  return Response.json({ code: '22023', message: 'resolved' }, { status: 400 });
}

function renderTab(tab: string | undefined, onNavigate = vi.fn()) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/feedback_counts')) return Response.json([{ open: 183, resolved: 317, other: 90 }]);
    if (url.includes('/rpc/feedback_page')) {
      const body = String(init?.body);
      pageCalls.push(JSON.parse(body));
      if (body.includes('"p_list":"other"')) return Response.json([OTHER]);
      return Response.json(body.includes('p_before') ? [RESOLVED] : resolvedPage);
    }
    if (url.includes('/rpc/open_feedback')) return Response.json(openRows);
    if (url.includes('/rpc/resolve_feedback_many')) return resolveResponse(init);
    return Response.json([]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider place="console"><FeedbackList venueId="v1" tab={tab} onNavigate={onNavigate} /></ToastProvider>
    </RivrDataProvider>,
  );
  return onNavigate;
}

describe('Feedback', () => {
  it('opens on the open tickets in a table, with the visit\u2019s tables and wait, and the tabs counting each list (F-013)', async () => {
    renderTab(undefined);
    expect(await screen.findByText('Ritika Bhalla \u00b7 No. 42', undefined, { timeout: 5000 })).toBeDefined();
    expect(screen.getByText(/^Check-in and check-out · 3 Nov · Check-in took ten minutes\.$/)).toBeDefined();
    expect(screen.getByText('2 of 5')).toBeDefined();
    expect(screen.getByText('Table 1, Table 3 \u00b7 waited 40 min')).toBeDefined();
    expect(screen.getByText('No visit')).toBeDefined();
    expect(screen.queryByText('Yuvraj Luthra \u00b7 No. 42')).toBeNull();
    // The counts are the server's, past the old limit of 500 in all (F-024).
    expect(screen.getByRole('link', { name: 'Open 183' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Resolved 317' }).getAttribute('href')).toBe('/feedback?tab=resolved');
    expect(screen.getByRole('link', { name: 'Other 90' }).getAttribute('href')).toBe('/feedback?tab=all');
  });

  it('shows on Resolved what was done and by whom, without the ratings that never were tickets (F-024)', async () => {
    renderTab('resolved');
    expect(await screen.findByText('Resolved by Vikram Rao on 3 Nov: Thanked him.', undefined, { timeout: 5000 })).toBeDefined();
    expect(screen.queryByText('Zoya Merchant · No. 42')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Resolve / })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });

  it('colours an age past its target, and only that (F-013)', async () => {
    renderTab(undefined);
    await screen.findByText('Rhea Kaul \u00b7 No. 42', undefined, { timeout: 5000 });
    expect(screen.getByText(/^1 h/).className).not.toContain('text-accent');
    // Colour is never the only sign (0463).
    expect(document.querySelectorAll('.text-accent')).toHaveLength(1);
    expect(screen.getByText(/ · overdue$/).className).toContain('text-accent');
  });

  it('opens a ticket\u2019s member from its row (F-013)', async () => {
    const onNavigate = renderTab(undefined);
    fireEvent.click(await screen.findByRole('button', { name: 'Rhea Kaul \u00b7 No. 42' }, { timeout: 5000 }));
    expect(onNavigate).toHaveBeenCalledWith('/members?member=m1');
  });

  it('resolves those ticked with one line of what was done (F-013)', async () => {
    renderTab(undefined);
    await screen.findByText('Rhea Kaul \u00b7 No. 42', undefined, { timeout: 5000 });
    for (const box of screen.getAllByRole('checkbox').slice(1)) fireEvent.click(box);
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'What was done' }), { target: { value: 'Called them both' } });
    fireEvent.click(screen.getByRole('button', { name: 'Resolve 2' }));
    await waitFor(() => expect(resolves).toEqual([{ p_feedback_ids: ['f1', 'f2'], p_resolution: 'Called them both' }]));
    expect(await screen.findByText('2 resolved')).toBeDefined();
  });

  it('says what the detailed form said, and that a rated visit had no seat (F-013)', async () => {
    openRows = [{ ...OPEN[0], topic: null, note: 'More PLO', ratings: { gameplay: 5, cashier: 3, service: 4, ambience: 5 }, nps: 9, visit_closed_at: '2026-11-02T20:00:00Z' }];
    renderTab(undefined);
    expect(await screen.findByText(/Gameplay 5 · Cashier 3 · Service 4 · Ambience 5 · More PLO$/, undefined, { timeout: 5000 })).toBeDefined();
    expect(screen.getByText('Not seated')).toBeDefined();
  });

  it('leaves out a ticket a colleague resolved meanwhile, so a retry goes through (F-013)', async () => {
    refuseResolve = true;
    renderTab(undefined);
    await screen.findByText('Rhea Kaul · No. 42', undefined, { timeout: 5000 });
    for (const box of screen.getAllByRole('checkbox').slice(1)) fireEvent.click(box);
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'What was done' }), { target: { value: 'Called them' } });
    openRows = [OPEN[1]];
    fireEvent.click(screen.getByRole('button', { name: 'Resolve 2' }));
    expect(await screen.findByText('Already resolved.')).toBeDefined();
    fireEvent.click(await screen.findByRole('button', { name: 'Resolve 1' }));
    await waitFor(() => expect(resolves[1]).toEqual({ p_feedback_ids: ['f2'], p_resolution: 'Called them' }));
  });

  it('shows on Other the ratings that never were tickets (F-024)', async () => {
    renderTab('all');
    expect(await screen.findByText('Zoya Merchant · No. 42', undefined, { timeout: 5000 })).toBeDefined();
    expect(pageCalls).toEqual([{ p_venue_id: 'v1', p_list: 'other' }]);
  });

  it('reads a long list a page at a time, the next after the last row shown (F-024)', async () => {
    resolvedPage = Array.from({ length: 50 }, (_, n) => ({ ...RESOLVED, id: `r${String(n)}`, created_at: `2026-11-03T06:00:${String(n).padStart(2, '0')}Z` }));
    renderTab('resolved');
    fireEvent.click(await screen.findByRole('button', { name: 'Show more' }, { timeout: 5000 }));
    await waitFor(() => expect(pageCalls[1]).toEqual({ p_venue_id: 'v1', p_list: 'resolved', p_before: '2026-11-03T06:00:49Z', p_before_id: 'r49' }));
    expect(await screen.findAllByText('Yuvraj Luthra · No. 42')).toHaveLength(51);
  });

  it('moves between the tabs through the address', async () => {
    const onNavigate = renderTab('nonsense');
    fireEvent.click(await screen.findByRole('link', { name: 'Resolved 317' }, { timeout: 5000 }));
    expect(onNavigate).toHaveBeenCalledWith('/feedback?tab=resolved');
  });
});

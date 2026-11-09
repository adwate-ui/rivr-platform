import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FeedbackList } from './FeedbackScreen.tsx';

afterEach(() => {
  pageCalls = [];
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
const OPEN = [
  { ...ROW, id: 'f1', full_name: 'Ritika Bhalla', note: 'Check-in took ten minutes.', topic: 'check_in_out' },
  { ...ROW, id: 'f2', full_name: 'Rhea Kaul', note: 'Waited for a chai.', topic: 'service' },
];
const RESOLVED = { ...ROW, id: 'f3', full_name: 'Yuvraj Luthra', note: 'Quick dealer.', resolved_at: '2026-11-03T08:00:00Z', resolved_by: 'Vikram Rao', resolution: 'Thanked him.' };
const OTHER = { ...ROW, id: 'f4', full_name: 'Zoya Merchant', note: null, is_ticket: false, score: 5, visit_closed_at: '2026-11-02T20:00:00Z' };

/** What each read gives; a full page of Resolved has another after it. */
let pageCalls: unknown[] = [];
let resolvedPage: unknown[] = [RESOLVED];

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
    return Response.json(url.includes('/rpc/venue_feedback') ? [...OPEN, RESOLVED, OTHER] : []);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <FeedbackList venueId="v1" tab={tab} onNavigate={onNavigate} />
    </RivrDataProvider>,
  );
  return onNavigate;
}

describe('Feedback', () => {
  it('opens on the open tickets, each with what was done to resolve it, the tabs counting each list', async () => {
    renderTab(undefined);
    expect(await screen.findByText('Ritika Bhalla · No. 42', undefined, { timeout: 5000 })).toBeDefined();
    expect(screen.getByText('Check-in and check-out · 3 Nov')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Resolve Rhea Kaul’s ticket' })).toBeDefined();
    expect(screen.queryByText('Yuvraj Luthra · No. 42')).toBeNull();
    // The counts are the server's, past the old limit of 500 in all (F-024).
    expect(screen.getByRole('link', { name: 'Open 183' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Resolved 317' }).getAttribute('href')).toBe('/feedback?tab=resolved');
    expect(screen.getByRole('link', { name: 'All feedback 90' }).getAttribute('href')).toBe('/feedback?tab=all');
  });

  it('shows on Resolved what was done and by whom, without the ratings that never were tickets (F-024)', async () => {
    renderTab('resolved');
    expect(await screen.findByText('Resolved by Vikram Rao on 3 Nov: Thanked him.', undefined, { timeout: 5000 })).toBeDefined();
    expect(screen.queryByText('Zoya Merchant · No. 42')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Resolve / })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });

  it('shows on All feedback the ratings that never were tickets (F-024)', async () => {
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

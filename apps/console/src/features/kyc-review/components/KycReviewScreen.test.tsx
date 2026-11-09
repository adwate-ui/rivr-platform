import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, StaffVenueProvider } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KycReviewScreen } from './KycReviewScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** A check as the queue lists it: waiting for review on a PAN alone, unless `status` says otherwise. */
const check = (memberId: string, name: string, status = 'needs_review', pan: string | null = 'ABCPR4444R') => ({
  member_id: memberId, full_name: name, status, method: 'pan', waiting_because: status === 'needs_review' ? 'pan_alone' : null,
  date_of_birth: '1991-06-15', masked_aadhaar: null, pan, address: null, photo_path: null, liveness_score: null, face_match_score: null,
  vendor_reference: null, refusal: null, clashes_with: [], updated_at: '2026-11-03T06:12:00Z',
});

const QUEUE = [check('m1', 'Rohan Bhatia'), check('m2', 'Naina Kapoor', 'needs_review', 'ABCPN4444N'), check('m3', 'Puneet Agarwal', 'needs_pan', null)];

/** A staff member in `role` on ID checks, with `queue` waiting, opened from Check ID with `checkName`; returns the decisions sent. */
function renderAs(role: string, queue: unknown[] = [], checkName?: string) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000108', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const decisions: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rest/v1/staff')) {
      return Response.json([{ id: 'st1', venue_id: 'v1', full_name: 'Karan Gill', role, venue: { name: 'RIVR Gurugram', is_practice: false } }]);
    }
    if (url.includes('/rpc/review_kyc')) {
      decisions.push(JSON.parse(String(init?.body)));
      return Response.json('verified');
    }
    return Response.json(url.includes('/rpc/kyc_review_queue') ? queue : []);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StaffVenueProvider><KycReviewScreen checkName={checkName} /></StaffVenueProvider>
    </RivrDataProvider>,
  );
  return decisions;
}

describe('ID checks (decision 0301)', () => {
  it.each(['host', 'floor'])('opens to the check in person alone for the %s, who reviews nothing', async (role) => {
    renderAs(role);
    expect(await screen.findByRole('heading', { level: 2, name: 'ID check in person' }, { timeout: 5000 })).toBeDefined();
    expect(screen.queryByText('No checks waiting for review.')).toBeNull();
  });

  it('gives an admin the checks to review and ID check in person, which opens its sheet', async () => {
    renderAs('admin');
    expect(await screen.findByText('No checks waiting for review.', {}, { timeout: 5000 })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'ID check in person' }));
    const sheet = screen.getByRole('dialog', { name: 'ID check in person' });
    expect(within(sheet).getByRole('searchbox', { name: 'Member\'s name or the last digits of their number' })).toBeDefined();
  });

  it('opens the check in person with the member searched, from the waitlist\'s Check ID (decision 0503)', async () => {
    renderAs('floor', [], 'Uday Thakur');
    expect(await screen.findByRole('searchbox', { name: 'Member\'s name or the last digits of their number' }, { timeout: 5000 }))
      .toHaveProperty('value', 'Uday Thakur');
    cleanup();
    renderAs('admin', [], 'Uday Thakur');
    const sheet = await screen.findByRole('dialog', { name: 'ID check in person' }, { timeout: 5000 });
    expect(within(sheet).getByRole('searchbox', { name: 'Member\'s name or the last digits of their number' })).toHaveProperty('value', 'Uday Thakur');
  });

  it('refuses a dealer, who checks no one', async () => {
    renderAs('dealer');
    expect(await screen.findByText('Not in your role. Ask an admin.', {}, { timeout: 5000 })).toBeDefined();
  });

  it('lists the checks by group with counts, and opens the first to review beside them, marked', async () => {
    renderAs('admin', QUEUE);
    expect(await screen.findByRole('heading', { level: 2, name: 'Rohan Bhatia' }, { timeout: 5000 })).toBeDefined();
    const queue = screen.getByRole('region', { name: 'Checks' });
    const toReview = within(queue).getByRole('list', { name: 'To review' });
    expect(within(toReview).getAllByRole('listitem')).toHaveLength(2);
    expect(within(toReview).getByRole('button', { name: /Rohan Bhatia/ }).getAttribute('aria-current')).toBe('true');
    expect(within(within(queue).getByRole('list', { name: 'Waiting on the member' })).getByRole('button', { name: /Puneet Agarwal/ })).toBeDefined();
    fireEvent.click(within(toReview).getByRole('button', { name: /Naina Kapoor/ }));
    expect(screen.getByRole('heading', { level: 2, name: 'Naina Kapoor' })).toBeDefined();
    expect(within(toReview).getByRole('button', { name: /Naina Kapoor/ }).getAttribute('aria-current')).toBe('true');
    expect(screen.getByText('ABCPN4444N')).toBeDefined();
  });

  it('refuses a reason holding a document number, and sends one in words', async () => {
    const decisions = renderAs('admin', QUEUE);
    const reason = await screen.findByRole('textbox', { name: 'Reason for Rohan Bhatia' }, { timeout: 5000 });
    fireEvent.change(reason, { target: { value: 'PAN ABCPR4444R seen' } });
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(await screen.findByText(/no document numbers/)).toBeDefined();
    expect(decisions).toEqual([]);
    fireEvent.change(reason, { target: { value: 'PAN card and the member seen at the desk' } });
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await vi.waitFor(() => expect(decisions).toEqual([
      { p_member_id: 'm1', p_approve: true, p_reason: 'PAN card and the member seen at the desk' },
    ]));
  });
});

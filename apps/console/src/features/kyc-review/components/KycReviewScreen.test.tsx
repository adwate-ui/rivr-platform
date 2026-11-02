import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, StaffVenueProvider } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KycReviewScreen } from './KycReviewScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** A staff member in `role` on KYC review, with no checks waiting. */
function renderAs(role: string) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000108', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rest/v1/staff')) {
      return Response.json([{ id: 'st1', venue_id: 'v1', full_name: 'Karan Gill', role, venue: { name: 'RIVR Gurugram', is_practice: false } }]);
    }
    return Response.json([]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StaffVenueProvider><KycReviewScreen /></StaffVenueProvider>
    </RivrDataProvider>,
  );
}

describe('KYC review (decision 0301)', () => {
  it.each(['host', 'floor'])('opens to the check in person alone for the %s, who reviews nothing', async (role) => {
    renderAs(role);
    expect(await screen.findByRole('heading', { level: 2, name: 'Check in person' }, { timeout: 5000 })).toBeDefined();
    expect(screen.queryByText('No checks waiting for review.')).toBeNull();
  });

  it('shows an admin the check in person and the checks to review', async () => {
    renderAs('admin');
    expect(await screen.findByText('No checks waiting for review.', {}, { timeout: 5000 })).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: 'Check in person' })).toBeDefined();
  });

  it('refuses a dealer, who checks no one', async () => {
    renderAs('dealer');
    expect(await screen.findByText('Not in your role. Ask an admin.', {}, { timeout: 5000 })).toBeDefined();
  });
});

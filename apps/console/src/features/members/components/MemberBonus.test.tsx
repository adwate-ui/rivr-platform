import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, StaffVenueProvider } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemberBonus } from './MemberBonus.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** The record's Bonus part for member m1, for a staff member who may (`canGive`) or may not add Bonus by hand. */
function renderPart(canGive: boolean) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async () => Response.json([]));
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StaffVenueProvider><MemberBonus venueId="v1" memberId="m1" canGive={canGive} /></StaffVenueProvider>
    </RivrDataProvider>,
  );
}

describe('MemberBonus: Bonus by hand on the record (redesign of 15 Nov)', () => {
  it('offers the form to staff who may add Bonus by hand, above the history', async () => {
    renderPart(true);
    const add = await screen.findByRole('button', { name: 'Add bonus chips' });
    const history = screen.getByRole('heading', { name: 'Bonus chips history' });
    expect(add.compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows other staff the balances and the history only', async () => {
    renderPart(false);
    expect(await screen.findByRole('heading', { name: 'Bonus chips history' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Add bonus chips' })).toBeNull();
  });
});

import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RedemptionList } from './RedemptionList.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const WAITING = {
  id: 'r1', member_id: 'm1', full_name: 'Kabir Sethi', member_number: 1042, reward_name: 'RIVR cap', kind: 'merchandise', points: 500, nights: null,
  created_at: '2026-11-01T18:00:00Z', handed_over_at: null, handed_over_by: null,
};

/** The list, signed in, with these redemptions. */
function renderList(rows: readonly unknown[]) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    return Response.json(url.includes('/rpc/venue_redemptions') ? rows : []);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RedemptionList venueId="v1" />
    </RivrDataProvider>,
  );
}

describe('RedemptionList', () => {
  it('says in one line that nothing waits, with no heading over it, and keeps what was handed over below (audit F-206)', async () => {
    renderList([]);
    expect(await screen.findByText('Nothing is waiting to be handed over.', {}, { timeout: 5000 })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Waiting to be handed over' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Handed over in the last 30 days' })).toBeDefined();
  });

  it('closes the cancel form on its own Cancel, leaving the redemption as it was (F2-22)', async () => {
    renderList([WAITING]);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel RIVR cap for Kabir Sethi' }, { timeout: 5000 }));
    expect(screen.getByRole('textbox', { name: 'Why RIVR cap for Kabir Sethi is cancelled' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('textbox', { name: 'Why RIVR cap for Kabir Sethi is cancelled' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Cancel RIVR cap for Kabir Sethi' })).toBeDefined();
  });
});

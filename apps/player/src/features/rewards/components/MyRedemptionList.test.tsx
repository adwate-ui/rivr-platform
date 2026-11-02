import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { memberRewards, registerMessages } from '@rivr/i18n';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MyRedemptionList } from './MyRedemptionList.tsx';

// As the Rewards screen does: the rewards copy is the player app's to load.
registerMessages({ memberRewards });

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const CAP = { id: 'r1', reward_name: 'RIVR cap', kind: 'merch', detail: 'At the host desk', points: 1000, nights: null,
  created_at: '2026-11-14T15:00:00Z', handed_over_at: null, cancelled_at: null, cancel_reason: null };

/** Mihir signed in, his redemptions as given. */
function renderList(rows: readonly object[]) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000213', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) =>
    Response.json(String(input instanceof Request ? input.url : input).includes('/rpc/my_redemptions') ? rows : []));
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MyRedemptionList />
    </RivrDataProvider>,
  );
}

describe('MyRedemptionList', () => {
  it('keeps a redemption staff cancelled, with why, where it used to vanish (decision 0302)', async () => {
    renderList([CAP, { ...CAP, id: 'r2', cancelled_at: '2026-11-14T16:00:00Z', cancel_reason: 'Out of caps at the desk' }]);
    expect(await screen.findByText('Cancelled: Out of caps at the desk', {}, { timeout: 5000 })).toBeDefined();
    expect(screen.getByText('To collect: At the host desk')).toBeDefined();
  });
});

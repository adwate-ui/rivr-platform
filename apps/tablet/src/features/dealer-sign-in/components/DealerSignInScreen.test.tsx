import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DealerSignInScreen } from './DealerSignInScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** A paired tablet signed in, and a fake API with two dealers who have a PIN. */
function renderScreen() {
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: '00000000-0000-4000-8000-0000000000d1', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
    }),
  );
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    return Response.json(url.includes('/rpc/tablet_dealers')
      ? [{ staff_id: 's1', full_name: 'Pema Lepcha' }, { staff_id: 's2', full_name: 'Tenzin Dorjee' }]
      : []);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <DealerSignInScreen />
    </RivrDataProvider>,
  );
}

describe('DealerSignInScreen', () => {
  it('shows the dealers as large buttons, then the chosen one\'s PIN pad, and Another dealer goes back (D-04)', async () => {
    renderScreen();
    fireEvent.click(await screen.findByRole('button', { name: 'Pema Lepcha' }, { timeout: 5000 }));
    expect(screen.getByRole('heading', { level: 2, name: 'Pema Lepcha' })).toBe(document.activeElement);
    expect(screen.getByRole('group', { name: 'PIN for Pema Lepcha' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Tenzin Dorjee' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Another dealer' }));
    expect(screen.getByRole('button', { name: 'Tenzin Dorjee' })).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: 'Dealers' })).toBe(document.activeElement);
  });
});

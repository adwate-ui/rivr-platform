import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, StaffVenueProvider } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PracticeResetScreen } from './PracticeResetScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** A super admin at the club and the practice venue, on Practice reset at the club. */
function renderReset() {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rest/v1/staff')) {
      return Response.json([
        { id: 'st1', venue_id: 'v1', full_name: 'Vikram Rao', role: 'super_admin', venue: { name: 'RIVR Gurugram', is_practice: false } },
        { id: 'st2', venue_id: 'p1', full_name: 'Vikram Rao', role: 'super_admin', venue: { name: 'RIVR Practice', is_practice: true } },
      ]);
    }
    return Response.json([]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StaffVenueProvider><PracticeResetScreen /></StaffVenueProvider>
    </RivrDataProvider>,
  );
}

describe('Practice reset in numbered steps (console v3)', () => {
  it('keeps the reset disabled at the club until the practice venue is on, then opens it', async () => {
    renderReset();
    const steps = await screen.findByRole('list', { name: 'Steps to reset the practice venue' }, { timeout: 5000 });
    const [first, second] = within(steps).getAllByRole('listitem');
    expect(first?.getAttribute('aria-current')).toBe('step');
    const reset = within(second ?? document.body).getByRole('button', { name: 'Reset to seed' });
    expect(reset.hasAttribute('disabled')).toBe(true);
    expect(screen.queryByRole('textbox', { name: 'Type the venue\'s name to confirm' })).toBeNull();

    fireEvent.click(within(first ?? document.body).getByRole('button', { name: 'Switch to practice' }));
    expect(await screen.findByText('You are in the practice venue.')).toBeDefined();
    expect(within(steps).getAllByRole('listitem')[1]?.getAttribute('aria-current')).toBe('step');
    expect(screen.getByRole('textbox', { name: 'Type the venue\'s name to confirm' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Reset to seed' }).hasAttribute('disabled')).toBe(false);
  });
});

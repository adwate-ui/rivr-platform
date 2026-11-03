import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, StaffVenueProvider } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DealerPinsSection } from './DealerPinsSection.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** A super admin on Dealer PINs with two dealers, one with a PIN; every PIN sent is kept. */
function renderPins() {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const sent: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rest/v1/staff')) {
      return Response.json([{ id: 'st1', venue_id: 'v1', full_name: 'Vikram Rao', role: 'super_admin', venue: { name: 'RIVR Gurugram', is_practice: false } }]);
    }
    if (url.includes('/rpc/venue_dealers')) {
      return Response.json([{ staff_id: 'd1', full_name: 'Bhavna Rawat', has_pin: false, locked_until: null },
        { staff_id: 'd2', full_name: 'Manoj Thapa', has_pin: true, locked_until: null }]);
    }
    if (url.includes('/rpc/set_dealer_pin')) sent.push(JSON.parse(String(init?.body)));
    return url.includes('/rpc/set_dealer_pin') ? new Response(null, { status: 204 }) : Response.json([]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StaffVenueProvider><DealerPinsSection /></StaffVenueProvider>
    </RivrDataProvider>,
  );
  return sent;
}

describe('Dealer PINs as a table (console v3)', () => {
  it('lists each dealer with where their PIN stands, and Set PIN or Change in the row', async () => {
    renderPins();
    const table = await screen.findByRole('table', { name: 'Dealer PINs' }, { timeout: 5000 });
    expect(within(table).getByText('No PIN yet')).toBeDefined();
    expect(within(table).getByText('PIN set')).toBeDefined();
    expect(within(table).getByRole('button', { name: 'Set PIN for Bhavna Rawat' }).textContent).toBe('Set PIN');
    expect(within(table).getByRole('button', { name: 'Set PIN for Manoj Thapa' }).textContent).toBe('Change');
    expect(screen.queryByLabelText('New PIN for Bhavna Rawat')).toBeNull();
  });

  it('opens one dealer’s PIN under their row, and sets it there', async () => {
    const sent = renderPins();
    fireEvent.click(await screen.findByRole('button', { name: 'Set PIN for Bhavna Rawat' }, { timeout: 5000 }));
    expect(screen.queryByLabelText('New PIN for Manoj Thapa')).toBeNull();
    fireEvent.change(screen.getByLabelText('New PIN for Bhavna Rawat'), { target: { value: '4826' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save PIN for Bhavna Rawat' }));
    await waitFor(() => expect(sent).toEqual([{ p_staff_id: 'd1', p_pin: '4826' }]));
    expect(await screen.findByText('PIN saved for Bhavna Rawat.')).toBeDefined();
  });
});

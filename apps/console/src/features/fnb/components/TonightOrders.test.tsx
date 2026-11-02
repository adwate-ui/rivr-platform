import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { formatTime } from '@rivr/i18n';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TonightOrders } from './TonightOrders.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const ORDER = { order_id: 'o12', kot_number: 12, table_name: 'Table 3', seat: 5, member_name: 'Yash Gupta', member_number: 1043,
  lines: [{ name: 'Masala chai', quantity: 1, note: null }], is_comp: false, source: 'app', created_at: '2026-11-15T16:10:00Z',
  kot_sent_at: null, kot_sent_by: null, accepted_at: null, delivered_at: null, age_seconds: 240, cancelled_at: null, cancel_reason: null };

/** Sameer, who serves, with tonight's orders as given. */
function renderOrders(rows: readonly object[]) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-0000000d0790', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) =>
    Response.json(String(input instanceof Request ? input.url : input).includes('/rpc/fnb_orders_tonight') ? rows : []));
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TonightOrders venueId="v1" />
    </RivrDataProvider>,
  );
}

describe('Tonight’s orders (decision 0302)', () => {
  it('says when each order was placed, and why one is void, which goes to no bar', async () => {
    renderOrders([ORDER, { ...ORDER, order_id: 'o13', kot_number: 13, cancelled_at: '2026-11-15T16:20:00Z', cancel_reason: 'Out of milk' }]);
    const placed = `Ordered ${formatTime(new Date(ORDER.created_at))}`;
    expect((await screen.findAllByText(new RegExp(placed), {}, { timeout: 5000 })).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Void: Out of milk/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Mark KOT 12 sent' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Mark KOT 13 sent' })).toBeNull();
  });
});

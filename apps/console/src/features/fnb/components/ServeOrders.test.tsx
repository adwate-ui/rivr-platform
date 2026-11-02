import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import type { FnbOrderTonight } from '@rivr/db/fnb';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServeOrders } from './ServeOrders.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const CHAI: FnbOrderTonight = {
  orderId: 'o12', kotNumber: 12, tableName: 'Table 3', seat: 5, memberName: 'Yash Gupta', memberNumber: 1043,
  lines: [{ name: 'Masala chai', quantity: 1, note: null }], isComp: false, source: 'app', createdAt: '2026-11-15T16:10:00Z',
  kotSentBy: 'agent', acceptedAt: null, deliveredAt: null, ageSeconds: 240, cancelledAt: null, cancelReason: null,
};
const FRIES: FnbOrderTonight = {
  ...CHAI, orderId: 'o13', kotNumber: 13, lines: [{ name: 'French fries', quantity: 1, note: null }],
  cancelledAt: '2026-11-15T16:20:00Z', cancelReason: 'Out of potatoes',
};

/** Sameer, who serves, with tonight's `orders`, and a fake API that keeps every void sent. */
function renderServe(orders: readonly FnbOrderTonight[]) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-0000000d0790', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const voided: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/cancel_fnb_order')) {
      voided.push(JSON.parse(String(init?.body)));
      return new Response(null, { status: 204 });
    }
    return Response.json([]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}>
      <ServeOrders venueId="v1" orders={orders} />
    </RivrDataProvider>,
  );
  return voided;
}

describe('ServeOrders (decision 0302)', () => {
  it('voids an order not yet delivered, with a reason the member sees', async () => {
    const voided = renderServe([CHAI]);
    fireEvent.click(screen.getByRole('button', { name: 'Void KOT 12' }));
    fireEvent.change(screen.getByRole('textbox', { name: /^Why void KOT 12/ }), { target: { value: 'Out of milk' } });
    fireEvent.click(screen.getByRole('button', { name: 'Void the order' }));
    await waitFor(() => expect(voided).toEqual([{ p_order_id: 'o12', p_reason: 'Out of milk' }]));
  });

  it('asks for a reason before it voids', async () => {
    const voided = renderServe([CHAI]);
    fireEvent.click(screen.getByRole('button', { name: 'Void KOT 12' }));
    fireEvent.click(screen.getByRole('button', { name: 'Void the order' }));
    expect(await screen.findByText('Give a reason of 3 to 300 characters.')).toBeDefined();
    expect(voided).toEqual([]);
  });

  it('lists a void order apart, with why, and never to accept', () => {
    renderServe([CHAI, FRIES]);
    expect(screen.getByRole('heading', { name: 'Void orders' })).toBeDefined();
    expect(screen.getByText('Void: Out of potatoes')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Accept KOT 13' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Accept KOT 12' })).toBeDefined();
  });
});

import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import type { FnbOrderTonight } from '@rivr/db/fnb';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrderBoard } from './OrderBoard.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const CHAI: FnbOrderTonight = {
  orderId: 'o12', kotNumber: 12, tableName: 'Table 3', seat: 5, memberName: 'Yash Gupta', memberNumber: 1043,
  lines: [{ itemId: 'chai', name: 'Masala chai', quantity: 1, note: null }], isComp: false, source: 'app', createdAt: '2026-11-15T16:10:00Z',
  kotSentBy: 'agent', isKotPrintFailed: false, acceptedAt: null, deliveredAt: null, ageSeconds: 240, cancelledAt: null, cancelReason: null, onWayAt: null,
};

/** Sameer, who serves, with tonight's `orders`, and a fake API that keeps every serving call sent. */
function renderBoard(orders: readonly FnbOrderTonight[]) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-0000000d0790', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const sent: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/')) {
      sent.push({ [url.replace(/^.*\/rpc\//, '')]: JSON.parse(String(init?.body)) });
      return new Response(null, { status: 204 });
    }
    return Response.json([]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}>
      <OrderBoard venueId="v1" orders={orders} />
    </RivrDataProvider>,
  );
  return sent;
}

describe('OrderBoard (decision 0302)', () => {
  it('shows what the member asked of the bar (F-052)', () => {
    renderBoard([{ ...CHAI, lines: [{ itemId: 'chai', name: 'Masala chai', quantity: 1, note: 'No ice, Less spicy' }] }]);
    expect(screen.getByText('Whole order: No ice, Less spicy')).toBeDefined();
  });

  it('names the KOTs members cancelled themselves, so the bar can drop one it holds (F-048)', () => {
    renderBoard([{ ...CHAI, cancelledAt: '2026-11-15T16:12:00Z', cancelReason: 'Cancelled by the member' }, { ...CHAI, orderId: 'o13', kotNumber: 13, cancelledAt: '2026-11-15T16:13:00Z', cancelReason: 'Out of chai' }]);
    expect(screen.getByText('Cancelled by the member: KOT 12')).toBeDefined();
  });

  it('voids an order not yet delivered, with a reason the member sees', async () => {
    const sent = renderBoard([CHAI]);
    fireEvent.click(screen.getByRole('button', { name: 'Void KOT 12' }));
    fireEvent.change(screen.getByRole('textbox', { name: /^Why void KOT 12/ }), { target: { value: 'Out of milk' } });
    fireEvent.click(screen.getByRole('button', { name: 'Void the order' }));
    await waitFor(() => expect(sent).toEqual([{ cancel_fnb_order: { p_order_id: 'o12', p_reason: 'Out of milk' } }]));
  });

  it('asks for a reason before it voids', async () => {
    const sent = renderBoard([CHAI]);
    fireEvent.click(screen.getByRole('button', { name: 'Void KOT 12' }));
    fireEvent.click(screen.getByRole('button', { name: 'Void the order' }));
    expect(await screen.findByText('Give a reason of 3 to 300 characters.')).toBeDefined();
    expect(sent).toEqual([]);
  });

  it('accepts an order placed', async () => {
    const sent = renderBoard([CHAI]);
    fireEvent.click(screen.getByRole('button', { name: 'Accept KOT 12' }));
    await waitFor(() => expect(sent).toEqual([{ accept_fnb_order: { p_order_id: 'o12' } }]));
  });

  it('sends an order being prepared on its way, which the member tracker reads, then says so (decision 0320)', async () => {
    const sent = renderBoard([{ ...CHAI, acceptedAt: '2026-11-15T16:12:00Z' }]);
    fireEvent.click(screen.getByRole('button', { name: 'KOT 12 on its way' }));
    await waitFor(() => expect(sent).toEqual([{ send_fnb_order_on_way: { p_order_id: 'o12' } }]));
    cleanup();
    renderBoard([{ ...CHAI, acceptedAt: '2026-11-15T16:12:00Z', onWayAt: '2026-11-15T16:15:00Z' }]);
    expect(screen.queryByRole('button', { name: 'KOT 12 on its way' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Mark KOT 12 delivered' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Void KOT 12' })).toBeDefined();
  });

  it('says how long a delivered order took, with nothing left to do on it', () => {
    renderBoard([{ ...CHAI, acceptedAt: '2026-11-15T16:12:00Z', deliveredAt: '2026-11-15T16:14:00Z', ageSeconds: 240 }]);
    expect(screen.getByText(/^Delivered in /)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Void KOT 12' })).toBeNull();
  });

  it('says each lane with nothing on it is empty', () => {
    renderBoard([]);
    expect(screen.getAllByText('Nothing here.')).toHaveLength(3);
  });
});

import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrdersTable } from './OrdersTable.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** An order as `fnb_orders_page` gives it: KOT 12, a chai for Table 3 seat 5, placed four minutes ago and not yet accepted. */
const CHAI = {
  total: 1, state: 'to_accept', order_id: 'o12', kot_number: 12, table_name: 'Table 3', seat: 5, member_name: 'Yash Gupta', member_number: 1043,
  lines: [{ item_id: 'chai', name: 'Masala chai', quantity: 1, note: null }], is_comp: false, source: 'app', created_at: '2026-11-15T16:10:00Z',
  kot_sent_at: null, kot_sent_by: 'agent', kot_print_failed: false, seat_state: 'seated', accepted_at: null, delivered_at: null, age_seconds: 240,
  cancelled_at: null, cancel_reason: null, on_way_at: null,
};
const ACCEPTED = { ...CHAI, state: 'preparing', accepted_at: '2026-11-15T16:12:00Z' };

interface Rendered { readonly sent: Record<string, unknown>[]; readonly asked: { rpc: string; body: Record<string, unknown> }[] }

/** Sameer, who serves, on the day's orders: the page answers `orders`, and every serving call sent is kept. */
function renderOrders(orders: readonly object[], cancelledKots: readonly number[] = []): Rendered {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-0000000d0790', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const sent: Rendered['sent'] = [];
  const asked: Rendered['asked'] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const rpc = String(input instanceof Request ? input.url : input).split('/rpc/')[1]?.split('?')[0];
    if (rpc === undefined) return Response.json([]);
    const body: Record<string, unknown> = JSON.parse(String(init?.body));
    if (rpc === 'fnb_orders_page' || rpc === 'list_choices') asked.push({ rpc, body });
    if (rpc === 'fnb_orders_page') return Response.json(orders);
    if (rpc === 'fnb_member_cancelled_kots') return Response.json(cancelledKots.map((kot) => ({ kot_number: kot })));
    if (rpc === 'list_choices') return Response.json([]);
    sent.push({ [rpc]: body });
    return new Response(null, { status: 204 });
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <OrdersTable venueId="v1" />
    </RivrDataProvider>,
  );
  return { sent, asked };
}

const WAIT = { timeout: 5000 };
const rowOf = async (kot: number) => (await screen.findByText(`KOT ${String(kot)}`, {}, WAIT)).closest<HTMLElement>('[role="row"]') ?? document.body;

describe('the orders, a row an order (decision 0302; redesign RD-30)', () => {
  it('shows what the member asked of the bar (F-052)', async () => {
    renderOrders([{ ...CHAI, lines: [{ item_id: 'chai', name: 'Masala chai', quantity: 1, note: 'No ice, Less spicy' }] }]);
    expect(within(await rowOf(12)).getByText('Whole order: No ice, Less spicy')).toBeDefined();
  });

  it('names the KOTs members cancelled themselves, so the bar can drop one it holds (F-048)', async () => {
    renderOrders([CHAI], [12, 14]);
    expect(await screen.findByText('Cancelled by the member: KOT 12, KOT 14', {}, WAIT)).toBeDefined();
  });

  it('accepts an order placed', async () => {
    const { sent } = renderOrders([CHAI]);
    fireEvent.click(within(await rowOf(12)).getByRole('button', { name: 'Accept KOT 12' }));
    await waitFor(() => expect(sent).toEqual([{ accept_fnb_order: { p_order_id: 'o12' } }]));
  });

  it('sends an order being prepared on its way, which the member tracker reads, then offers only Delivered and Void (decision 0320)', async () => {
    const { sent } = renderOrders([ACCEPTED]);
    const row = await rowOf(12);
    // Its steps in order: on its way, then delivered (audit F-096).
    const steps = within(row).getAllByRole('button').map((button) => button.getAttribute('aria-label'));
    expect(steps.indexOf('KOT 12 on its way')).toBeLessThan(steps.indexOf('Mark KOT 12 delivered'));
    fireEvent.click(within(row).getByRole('button', { name: 'KOT 12 on its way' }));
    await waitFor(() => expect(sent).toEqual([{ send_fnb_order_on_way: { p_order_id: 'o12' } }]));
    cleanup();
    renderOrders([{ ...ACCEPTED, on_way_at: '2026-11-15T16:15:00Z' }]);
    const sentOff = await rowOf(12);
    expect(within(sentOff).queryByRole('button', { name: 'KOT 12 on its way' })).toBeNull();
    expect(within(sentOff).getByRole('button', { name: 'Mark KOT 12 delivered' })).toBeDefined();
    expect(within(sentOff).getByRole('button', { name: 'Void KOT 12' })).toBeDefined();
  });

  it('says on its way and how long, once the runner has left (audit F-096)', async () => {
    renderOrders([{ ...ACCEPTED, on_way_at: '2026-11-15T16:13:00Z' }]);
    expect(within(await rowOf(12)).getByText('On its way · 4 min')).toBeDefined();
  });

  it('says a ticket is late past fifteen minutes, in words and in red (audit F-075)', async () => {
    renderOrders([{ ...CHAI, age_seconds: 16 * 60 }]);
    expect(within(await rowOf(12)).getByText('Late · 16 min').className).toContain('text-danger');
  });

  it('says the guest is leaving or has left, while the order stands (audit F-085)', async () => {
    renderOrders([{ ...CHAI, total: 2, seat_state: 'leaving' }, { ...CHAI, total: 2, order_id: 'o13', kot_number: 13, seat_state: 'left' }]);
    expect(within(await rowOf(12)).getByText('The guest is leaving.')).toBeDefined();
    expect(within(await rowOf(13)).getByText('Guest left. Deliver at the door or void.')).toBeDefined();
  });

  it('says nothing of a guest gone once the order is delivered, and leaves nothing to do on it', async () => {
    renderOrders([{ ...ACCEPTED, state: 'delivered', delivered_at: '2026-11-15T16:20:00Z', seat_state: 'left' }]);
    const row = await rowOf(12);
    expect(within(row).queryByText(/Guest left/)).toBeNull();
    expect(within(row).queryByRole('button')).toBeNull();
  });

  it('asks for a reason before it voids, in the panel', async () => {
    const { sent } = renderOrders([CHAI]);
    fireEvent.click(within(await rowOf(12)).getByRole('button', { name: 'Void KOT 12' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Void KOT 12' })).getByRole('button', { name: 'Void the order' }));
    expect(await screen.findByText('Give a reason of 3 to 300 characters.')).toBeDefined();
    expect(sent).toEqual([]);
  });

  it('says no orders when the day has none of the state chosen', async () => {
    renderOrders([]);
    expect(await screen.findByText('No orders.', {}, WAIT)).toBeDefined();
  });

  it('counts a column’s menu over the state chosen, and the chips over every state of the day', async () => {
    const { asked } = renderOrders([CHAI]);
    await rowOf(12);
    const scopes = asked.filter((one) => one.rpc === 'list_choices').map((one) => JSON.stringify(one.body['p_view']));
    await waitFor(() => expect(scopes.some((view) => view.includes('"state":"open"'))).toBe(true));
    expect(scopes.some((view) => view.includes('"state":"all"'))).toBe(true);
  });

  it('reads today’s club day as it is now: left open past 06:00, it asks for the new day', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-11-16T05:58:00+05:30') });
    const { asked } = renderOrders([CHAI]);
    await rowOf(12);
    const days = () => asked.filter((one) => one.rpc === 'fnb_orders_page').map((one) => /"day":"([\d-]+)"/.exec(JSON.stringify(one.body))?.[1]);
    expect(days().at(-1)).toBe('2026-11-15');
    await vi.advanceTimersByTimeAsync(3 * 60_000);
    await waitFor(() => expect(days().at(-1)).toBe('2026-11-16'));
  });
});

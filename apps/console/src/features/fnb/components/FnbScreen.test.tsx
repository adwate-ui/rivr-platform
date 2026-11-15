import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, StaffVenueProvider } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FnbScreen } from './FnbScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const ORDER = {
  order_id: 'o4', kot_number: 4, table_name: 'Private Room', seat: 4, member_name: 'Lalit Goel', member_number: 92,
  lines: [{ item_id: 'beer', name: 'Beer', quantity: 2, note: null }], is_comp: false, source: 'app', created_at: '2026-11-15T16:10:00Z',
  kot_sent_at: null, kot_sent_by: null, accepted_at: null, delivered_at: null, age_seconds: 300, cancelled_at: null, cancel_reason: null,
  on_way_at: null, kot_print_failed: false,
};
const TONIGHT = [
  { ...ORDER, kot_print_failed: true },
  { ...ORDER, order_id: 'o2', kot_number: 2, member_name: 'Payal Agarwal', accepted_at: '2026-11-15T16:12:00Z', kot_sent_by: 'agent' },
  { ...ORDER, order_id: 'o3', kot_number: 3, member_name: 'Nakul Dhillon', accepted_at: '2026-11-15T16:12:00Z', delivered_at: '2026-11-15T16:13:00Z', age_seconds: 60 },
  { ...ORDER, order_id: 'o5', kot_number: 5, member_name: 'Samar Dua', cancelled_at: '2026-11-15T16:20:00Z', cancel_reason: 'Left the table' },
];
const TABLES = [
  { id: 't1', venue_id: 'v1', name: 'Table 1', is_open: true, seats: 9, position: 1, table_type_id: 'nlh', must_move_to_table_id: null, room: 'main', min_buy_in_paise: 1000000 },
  { id: 't2', venue_id: 'v1', name: 'Table 2', is_open: true, seats: 9, position: 2, table_type_id: 'nlh', must_move_to_table_id: null, room: 'main', min_buy_in_paise: 1000000 },
];
const TYPES = [{ id: 'nlh', name: 'NLH 100/200', game: 'nlh', small_blind_paise: 10000, big_blind_paise: 20000, straddle_paise: null }];
const SEATED = { session_id: 's1', table_id: 't2', seat: 3, member_id: 'm1', full_name: 'Sakshi Tandon', tier_name: 'Black card', started_at: '2026-11-15T15:00:00Z',
  must_move_order: null, away_since: null, call_time_left: null, leaving_at: null, top_up: null, time_request_id: null, time_request_minutes: null };
const MENU = [{ item_id: 'chai', name: 'Masala chai', kind: 'soft_drink', photo_path: null }];

/** Where an order of the fixture stands, as the server says it. */
const stateOf = (order: { cancelled_at: string | null; delivered_at: string | null; accepted_at: string | null }) => (order.cancelled_at !== null ? 'void' : order.delivered_at !== null ? 'delivered' : order.accepted_at === null ? 'to_accept' : 'preparing');

/** The page the server would give of tonight's orders for a view: by the state its scope asks for, open unless it says otherwise. */
function pageOf(body: unknown): readonly object[] {
  const state = /"state":"(\w+)"/.exec(JSON.stringify(body))?.[1] ?? 'open';
  const kept = TONIGHT.filter((order) => state === 'all' || (state === 'open' ? ['to_accept', 'preparing'].includes(stateOf(order)) : stateOf(order) === state));
  return kept.map((order) => ({ ...order, total: kept.length, state: stateOf(order) }));
}

// As the server counts each state over the day.
const STATES = [
  { column_key: 'state', value: 'to_accept', members: 1 }, { column_key: 'state', value: 'preparing', members: 1 },
  { column_key: 'state', value: 'delivered', members: 1 }, { column_key: 'state', value: 'void', members: 1 }, { column_key: 'table', value: 'Private Room', members: 4 },
];

/** The reads each test answers: the day's orders (a function is given what was asked), the floor and the menu; anything else answers nothing. */
const READS: Record<string, unknown> = {
  '/rpc/fnb_orders_page': pageOf, '/rpc/list_choices': STATES, '/rest/v1/game_table': TABLES, '/rest/v1/table_type': TYPES, '/rpc/floor_seats': [SEATED], '/rpc/fnb_menu': MENU,
};

/** A read that answers 503: the API cannot be reached. */
const FAILS = Symbol('fails');

/** A read's answer: a failure, what a function makes of what was asked, or the rows as they are. */
function answerWith(answer: unknown, init: RequestInit | undefined): Response {
  if (answer === FAILS) return Response.json({ message: 'unreachable' }, { status: 503 });
  return Response.json(typeof answer === 'function' ? answer(JSON.parse(String(init?.body))) : answer);
}

interface Rendered { readonly calls: { url: string; body: unknown }[] }

/** A staff member in `role` on Food and drink at `tab`, with the reads above (or `reads`), keeping every call the screen makes. */
function renderAs(role: string, tab: string | undefined = undefined, reads: Record<string, unknown> = READS): Rendered {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000108', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const calls: Rendered['calls'] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (init?.method === 'POST' && !url.includes('/rpc/fnb_orders_page') && !url.includes('/rpc/list_choices')) calls.push({ url, body: JSON.parse(String(init.body)) });
    if (url.includes('/rest/v1/staff')) {
      return Response.json([{ id: 'st1', venue_id: 'v1', full_name: 'Farida Floor', role, venue: { name: 'RIVR Gurugram', is_practice: false } }]);
    }
    const path = Object.keys(reads).find((one) => url.includes(one));
    if (path === undefined) return Response.json([]);
    return answerWith(reads[path], init);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StaffVenueProvider><FnbScreen tab={tab} onNavigate={vi.fn()} /></StaffVenueProvider>
    </RivrDataProvider>,
  );
  return { calls };
}

const WAIT = { timeout: 5000 };

/** The orders' table, once it is drawn. */
const orders = () => screen.findByRole('table', { name: 'Orders' }, WAIT);

describe('Food and drink (console v3)', () => {
  it('opens on the day\'s open orders as a table from the server, with each state\'s count on its chip (redesign RD-30)', async () => {
    renderAs('service');
    const table = await orders();
    const first = (await within(table).findByText('KOT 4')).closest('[role="row"]');
    for (const shown of ['Private Room, seat 4', 'Lalit Goel', '2 × Beer', 'To accept']) expect(first?.textContent).toContain(shown);
    expect(within(table).getByRole('button', { name: 'Accept KOT 4' })).toBeDefined();
    expect(within(table).getByRole('button', { name: 'Mark KOT 2 delivered' })).toBeDefined();
    // Delivered and void orders are out of the way, behind their chips.
    expect(within(table).queryByText('KOT 3')).toBeNull();
    expect(within(table).queryByText('KOT 5')).toBeNull();
    const chips = screen.getByRole('radiogroup', { name: 'State' });
    for (const chip of ['Open, 2', 'Delivered, 1', 'Void, 1', 'All, 4']) expect(await within(chips).findByRole('radio', { name: chip })).toBeDefined();
    fireEvent.click(within(chips).getByRole('radio', { name: /^Void/ }));
    const voided = (await within(table).findByText('KOT 5')).closest('[role="row"]');
    expect(voided?.textContent).toContain('Left the table');
    expect(within(table).queryByText('KOT 4')).toBeNull();
    expect(within(table).queryByRole('button', { name: /KOT 5/ })).toBeNull();
  });

  it('voids an order from its row, with a reason typed in the panel at the side (redesign RD-38)', async () => {
    const { calls } = renderAs('service');
    fireEvent.click(await within(await orders()).findByRole('button', { name: 'Void KOT 4' }));
    const panel = within(await screen.findByRole('dialog', { name: 'Void KOT 4' }));
    expect(panel.getByText('The member sees this.')).toBeDefined();
    fireEvent.change(panel.getByRole('textbox', { name: 'Why void KOT 4' }), { target: { value: 'Ordered twice' } });
    fireEvent.click(screen.getByRole('button', { name: 'Void the order' }));
    await waitFor(() => expect(calls.find((call) => call.url.includes('/rpc/cancel_fnb_order'))?.body).toMatchObject({ p_order_id: 'o4', p_reason: 'Ordered twice' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('says the bar printer did not get a KOT only when the outbox says so, and lets a manager mark that the bar has it', async () => {
    const { calls } = renderAs('admin');
    expect(await screen.findByText('The bar printer did not get this KOT. Print it or read it to the bar.', {}, WAIT)).toBeDefined();
    expect(screen.getAllByText(/^The bar printer did not get/)).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Print KOT 4' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'KOT 4: bar has it' }));
    await waitFor(() => expect(calls.find((call) => call.url.includes('/rpc/mark_kot_sent'))?.body).toEqual({ p_order_id: 'o4' }));
  });

  it('gives Service, who read no members, serving alone: no new order, but a KOT the bar printer missed to print and mark handed over', async () => {
    const { calls } = renderAs('service');
    await orders();
    expect(screen.queryByRole('button', { name: 'New order' })).toBeNull();
    expect(await screen.findByRole('button', { name: 'Print KOT 4' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'KOT 4: bar has it' }));
    await waitFor(() => expect(calls.find((call) => call.url.includes('/rpc/mark_kot_sent'))?.body).toEqual({ p_order_id: 'o4' }));
  });

  it('prints a KOT the bar printer missed with its table and seat, naming no member, as the bar printer does', async () => {
    const print = vi.fn();
    vi.stubGlobal('print', print);
    renderAs('service');
    fireEvent.click(await screen.findByRole('button', { name: 'Print KOT 4' }, WAIT));
    expect(print).toHaveBeenCalledOnce();
    const paper = document.querySelector('[data-print-sheet]');
    expect(paper?.textContent).toContain('KOT 4');
    expect(paper?.textContent).toContain('Private Room, seat 4');
    expect(paper?.textContent).toContain('2 × Beer');
    expect(paper?.textContent).not.toContain('Lalit Goel');
  });

  it('prints what the member asked of the bar on a KOT printed by hand, for the whole order (F-052)', async () => {
    vi.stubGlobal('print', vi.fn());
    const lines = [{ item_id: 'fries', name: 'French fries', quantity: 1, note: 'No onion' }, { item_id: 'beer', name: 'Beer', quantity: 2, note: null }];
    renderAs('service', undefined, { ...READS, '/rpc/fnb_orders_page': [{ ...ORDER, total: 1, lines, kot_print_failed: true }] });
    fireEvent.click(await screen.findByRole('button', { name: 'Print KOT 4' }, WAIT));
    expect(document.querySelector('[data-print-sheet]')?.textContent).toContain('Whole order: No onion');
  });

  it('orders for a seat: the table first, then the seat with who sits there, then the items (F&B order, table then seat)', async () => {
    const { calls } = renderAs('floor');
    fireEvent.click(await screen.findByRole('button', { name: 'New order' }, WAIT));
    const sheet = within(await screen.findByRole('dialog', { name: 'New order' }));
    // Only tables with someone seated: Table 1 has nobody.
    expect(sheet.queryByRole('radio', { name: 'Table 1' })).toBeNull();
    expect(sheet.queryByRole('radiogroup', { name: 'Seat' })).toBeNull();
    fireEvent.click(await sheet.findByRole('radio', { name: 'Table 2' }, WAIT));
    fireEvent.click(sheet.getByRole('radio', { name: '3 · Sakshi Tandon' }));
    fireEvent.click(await sheet.findByRole('button', { name: 'One more Masala chai' }, WAIT));
    expect(sheet.queryByRole('switch', { name: /^Comp it/ })).toBeNull();
    fireEvent.click(sheet.getByRole('button', { name: 'Send to the bar' }));
    await waitFor(() => expect(calls.find((call) => call.url.includes('/rpc/console_fnb_order'))?.body).toMatchObject({
      p_venue_id: 'v1', p_table_id: 't2', p_seat: 3, p_lines: [{ item_id: 'chai', quantity: 1, note: null }], p_is_comp: false,
    }));
  });

  it('keeps the menu on its own tab', async () => {
    renderAs('admin', 'menu', { ...READS, '/rest/v1/fnb_item': [{ id: 'chai', name: 'Masala chai', kind: 'soft_drink', is_available: true, position: 1, photo_path: null }] });
    const csv = await screen.findByRole('button', { name: 'Menu from a CSV' }, WAIT);
    expect(screen.queryByRole('table', { name: 'Orders' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Menu' }).getAttribute('aria-current')).toBe('page');
    // The menu from a CSV opens in the panel at the side (redesign RD-38).
    fireEvent.click(csv);
    expect(within(screen.getByRole('dialog', { name: 'Menu from a CSV' })).getByText(/^Columns: name, type/)).toBeDefined();
  });

  it('opens the orders for a tab it does not know', async () => {
    renderAs('service', 'kitchen');
    expect(await orders()).toBeDefined();
  });

  it('says tonight\'s orders did not load, with Try again', async () => {
    renderAs('service', undefined, { ...READS, '/rpc/fnb_orders_page': FAILS });
    expect((await screen.findByRole('alert', {}, WAIT)).textContent).toMatch(/^Not loaded/);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined();
  });
});

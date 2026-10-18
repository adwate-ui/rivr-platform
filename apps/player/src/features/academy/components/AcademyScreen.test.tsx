import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AcademyScreen } from './AcademyScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const LEVEL_1 = { id: 'b1', name: 'Level 1', starts_on: '2026-11-15', ends_on: '2026-11-17', seats_left: 4, fee: 200000 };

/** Kabir's seat in Level 1, unpaid and held for another day. */
const KABIRS_SEAT = {
  id: 'k1', batch_id: 'b1', batch_name: 'Level 1', starts_on: '2026-11-15', ends_on: '2026-11-17', status: 'awaiting_payment',
  amount: 200000, utr: null, turned_down_utr: null, hold_until: new Date(Date.now() + 86_400_000).toISOString(),
};

interface Setup {
  openBatches?: unknown[][];
  refusalCode?: string;
  holdSecondBooking?: boolean;
  /** Academy booking for Kabir's tier: enabled, locked to the Black card, or hidden. */
  access?: 'enabled' | 'locked' | 'hidden';
  myBookings?: unknown[];
}

/**
 * Kabir signed in, and a fake API: his Academy access, the open batches it is given (each answer in
 * turn, the last one again), his seats, and the booking refusal it is given.
 */
function renderAcademy({ openBatches = [[]], refusalCode = 'RVBAT', holdSecondBooking = false, access = 'enabled', myBookings = [] }: Setup) {
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      access_token: 'test',
      refresh_token: 'test',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: '00000000-0000-4000-8000-000000000202', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
    }),
  );
  let asked = 0;
  let bookings = 0;
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/my_feature_access')) {
      return Response.json([{ feature_key: 'academy.booking', state: access, tiers: access === 'locked' ? ['Black card'] : null }]);
    }
    if (url.includes('/rpc/academy_open_batches')) return Response.json(openBatches[Math.min(asked++, openBatches.length - 1)]);
    if (url.includes('/rpc/my_academy_bookings')) return Response.json(myBookings);
    if (url.includes('/rpc/book_academy')) {
      // A second try that is still going, when asked for: the first one's refusal must already be gone.
      if (++bookings > 1 && holdSecondBooking) await new Promise(() => undefined);
      return Response.json({ code: refusalCode, message: 'refused' }, { status: 400 });
    }
    return Response.json([]);
  });
  const client = createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' });
  const router = createRouter({
    routeTree: createRootRoute({ component: AcademyScreen }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  render(
    <RivrDataProvider client={client}>
      <RouterProvider router={router} />
    </RivrDataProvider>,
  );
}

describe('the Academy screen without Academy booking', () => {
  it('still shows the member\'s own seats, to read only, with the locked notice in place of the open batches', async () => {
    renderAcademy({ access: 'locked', myBookings: [KABIRS_SEAT], openBatches: [[LEVEL_1]] });
    expect(await screen.findByRole('heading', { name: 'Your bookings' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Level 1' })).toBeDefined();
    expect(screen.getByText('Booked. Pay to keep your seat.')).toBeDefined();
    expect(screen.getByText('Black card only.')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Pay' })).toBeNull();
    // Paying is not theirs to do here, so neither is the deadline for it.
    expect(screen.queryByText(/^Pay by/)).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Open batches' })).toBeNull();
  });

  it('shows the seats, and nothing in place of the batches, when Academy booking is hidden from the tier', async () => {
    renderAcademy({ access: 'hidden', myBookings: [KABIRS_SEAT] });
    expect(await screen.findByRole('heading', { name: 'Your bookings' })).toBeDefined();
    expect(screen.getByText('Booked. Pay to keep your seat.')).toBeDefined();
    expect(screen.queryByText('Black card only.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pay' })).toBeNull();
  });

  it('offers no change of UTR on a seat waiting for the cashier', async () => {
    renderAcademy({ access: 'locked', myBookings: [{ ...KABIRS_SEAT, status: 'payment_claimed', utr: '123456789012', hold_until: null }] });
    expect(await screen.findByText(/^Payment sent with UTR 123456789012/)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Change the UTR' })).toBeNull();
  });

  it('shows only the locked notice to a member with no seats, as before', async () => {
    renderAcademy({ access: 'locked' });
    expect(await screen.findByText('Black card only.')).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Your bookings' })).toBeNull();
  });
});

describe('the Academy screen', () => {
  it('still says why a booking was refused, by the batch\'s name, once the batch has closed and left the list', async () => {
    renderAcademy({ openBatches: [[LEVEL_1], []], refusalCode: 'RVBAT' });
    fireEvent.click(await screen.findByRole('button', { name: 'Book a seat' }));
    expect(await screen.findByText('Level 1: This batch is not open for booking.')).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Level 1' })).toBeNull();
    expect(screen.getByText('No batches open right now.')).toBeDefined();
  });

  it('says a batch that has just filled once, on its card', async () => {
    renderAcademy({ openBatches: [[LEVEL_1], [{ ...LEVEL_1, seats_left: 0 }]], refusalCode: 'RVFUL' });
    fireEvent.click(await screen.findByRole('button', { name: 'Book a seat' }));
    expect(await screen.findByText('This batch is full.')).toBeDefined();
    expect(screen.queryByText('Level 1: This batch is full.')).toBeNull();
  });

  it('says why on the card itself while the batch is still listed, where the member tapped', async () => {
    renderAcademy({ openBatches: [[LEVEL_1]], refusalCode: 'RVPRC' });
    fireEvent.click(await screen.findByRole('button', { name: 'Book a seat' }));
    expect(await screen.findAllByText('The club has not set the Academy fee yet. Try again later.')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Level 1' })).toBeDefined();
  });

  it('says a refusal about the whole club in its own words, not as the batch\'s', async () => {
    renderAcademy({ openBatches: [[LEVEL_1], []], refusalCode: 'RVFRZ' });
    fireEvent.click(await screen.findByRole('button', { name: 'Book a seat' }));
    expect(await screen.findByText('The club is paused. Staff will assist you.')).toBeDefined();
    expect(screen.queryByText(/^Level 1:/)).toBeNull();
  });

  it('drops an earlier refusal as soon as the member tries again', async () => {
    renderAcademy({ openBatches: [[LEVEL_1]], refusalCode: 'RVPRC', holdSecondBooking: true });
    fireEvent.click(await screen.findByRole('button', { name: 'Book a seat' }));
    await screen.findByText('The club has not set the Academy fee yet. Try again later.');
    fireEvent.click(screen.getByRole('button', { name: 'Book a seat' }));
    expect(screen.queryByText('The club has not set the Academy fee yet. Try again later.')).toBeNull();
  });
});

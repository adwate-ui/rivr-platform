import { fromPaise } from '@rivr/domain/money';
import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import { useAddClubEvent, useBookClubEvent, useMyClubEvents, useVenueClubEvents } from './clubEvents.ts';
import { useAddCreator, useCreatorDashboard } from './creators.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const VENUE = '00000000-0000-4000-8000-000000000001';
const EVENT = { event_id: 'e1', kind: 'pro_night', title: 'Pro night', starts_at: '2026-11-20T15:30:00+00:00', seats: 8, details: null };

/** A fake API: each path answers with its reply; every call is kept with what it sent. */
function renderHooks(replies: Record<string, { status?: number; body: unknown }>) {
  const calls: { url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const path = Object.keys(replies).find((key) => url.includes(key));
    const reply = path ? replies[path] : undefined;
    return Response.json(reply?.body ?? [], { status: reply?.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor('00000000-0000-4000-8000-000000000103'), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({
    venue: useVenueClubEvents(VENUE), add: useAddClubEvent(VENUE), mine: useMyClubEvents(), book: useBookClubEvent(),
    creators: useCreatorDashboard(VENUE), addCreator: useAddCreator(VENUE),
  }), { wrapper });
  return { result, calls };
}

const bodyOf = (calls: { url: string; body: unknown }[], path: string) => calls.find((call) => call.url.includes(path))?.body;

afterEach(cleanup);

describe('the events calendar', () => {
  it('reads the venue\'s and the member\'s events, adds one and books a seat, saying why one is refused', async () => {
    const { result, calls } = renderHooks({
      '/rpc/venue_club_events': { body: [{ ...EVENT, booked: 3 }] },
      '/rpc/my_club_events': { body: [{ ...EVENT, kind: 'corporate_table', seats_left: 5, is_booked: true }] },
      '/rpc/book_club_event': { status: 400, body: { code: 'RVEVT', message: 'full', hint: 'full' } },
    });
    await waitFor(() => expect(result.current.venue.data?.[0]).toEqual({
      eventId: 'e1', kind: 'pro_night', title: 'Pro night', startsAt: EVENT.starts_at, seats: 8, details: null, booked: 3,
    }));
    await waitFor(() => expect(result.current.mine.data?.[0]).toMatchObject({ kind: 'corporate_table', seatsLeft: 5, isBooked: true }));
    let booked: unknown;
    await act(async () => {
      await result.current.add.mutateAsync({ kind: 'pro_night', title: 'Pro night', startsAt: new Date(EVENT.starts_at), seats: 8, details: '' });
      booked = await result.current.book.mutateAsync({ eventId: 'e1', isBooking: true });
    });
    expect(booked).toEqual({ ok: false, error: 'full' });
    expect(bodyOf(calls, '/rpc/create_club_event')).toEqual({
      p_venue_id: VENUE, p_kind: 'pro_night', p_title: 'Pro night', p_starts_at: '2026-11-20T15:30:00.000Z', p_seats: 8, p_details: '',
    });
    expect(bodyOf(calls, '/rpc/book_club_event')).toEqual({ p_event_id: 'e1', p_is_booking: true });
  });
});

describe('creators', () => {
  it('reads each creator\'s dashboard in paise, and adds one, a code taken refused', async () => {
    const { result, calls } = renderHooks({
      '/rpc/creator_dashboard': { body: [{ creator_id: 'c1', name: 'Zoya', code: 'ZOYA', commission_basis: 'first_visit', commission_paise: 50000,
        signed_up: 2, kyc_done: 1, visited: 1, bought_in: 0, owed_paise: 50000 }] },
      '/rpc/save_creator': { status: 409, body: { code: '23505', message: 'taken' } },
    });
    await waitFor(() => expect(result.current.creators.data?.[0]).toEqual({
      creatorId: 'c1', name: 'Zoya', code: 'ZOYA', basis: 'first_visit', commission: 50000n, signedUp: 2, kycDone: 1, visited: 1, boughtIn: 0, owed: 50000n,
    }));
    let added: unknown;
    await act(async () => { added = await result.current.addCreator.mutateAsync({ name: 'Zoya', code: 'ZOYA', basis: 'kyc', commission: fromPaise(10000n) }); });
    expect(added).toEqual({ ok: false, error: 'taken' });
    expect(bodyOf(calls, '/rpc/save_creator')).toEqual({ p_venue_id: VENUE, p_name: 'Zoya', p_code: 'ZOYA', p_basis: 'kyc', p_commission_paise: 10000 });
  });
});

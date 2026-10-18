import { indianMobileSchema } from '@rivr/contracts';
import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useStaffAcademyActions, useStaffAcademyBatches, useStaffAcademyBookings } from './academyStaff.ts';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const ADITYA = '00000000-0000-4000-8000-000000000103';

/** A fake API: each path answers with its reply; the calls are recorded. */
function renderStaffAcademy(replies: Record<string, { status?: number; body: unknown }>) {
  const calls: { url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const path = Object.keys(replies).find((key) => url.includes(key));
    const reply = path ? replies[path] : undefined;
    return Response.json(reply?.body ?? null, { status: reply?.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(ADITYA), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(
    () => ({ batches: useStaffAcademyBatches('v1'), bookings: useStaffAcademyBookings('v1'), actions: useStaffAcademyActions('v1') }),
    { wrapper },
  );
  return { result, calls };
}

afterEach(cleanup);

describe('the Academy, as staff see it', () => {
  it('gives the venue\'s batches and bookings, money in paise as bigint', async () => {
    const { result, calls } = renderStaffAcademy({
      '/rpc/staff_academy_batches': {
        body: [{ id: 'b1', name: 'Level 1', starts_on: '2026-11-15', ends_on: '2026-11-17', seats: 12, is_open: true, seats_taken: 4 }],
      },
      '/rest/v1/academy_booking': {
        body: [{
          id: 'k1', batch_id: 'b1', company_name: 'Acme Pvt Ltd', seats: 3, amount: 450000, status: 'payment_claimed', utr: '512345678901',
          recorded_by_staff_id: 's103', member: { full_name: 'Naina Kapoor' },
        }],
      },
    });

    await waitFor(() => expect(result.current.batches.data).toEqual([
      { id: 'b1', name: 'Level 1', startsOn: '2026-11-15', endsOn: '2026-11-17', seats: 12, seatsTaken: 4, isOpen: true },
    ]));
    await waitFor(() => expect(result.current.bookings.data).toEqual([{
      id: 'k1', batchId: 'b1', memberName: 'Naina Kapoor', companyName: 'Acme Pvt Ltd', seats: 3, amount: 450000n,
      status: 'payment_claimed', utr: '512345678901', recordedByStaffId: 's103',
    }]));
    expect(calls.find((call) => call.url.includes('/rpc/staff_academy_batches'))?.body).toEqual({ p_venue_id: 'v1' });
    expect(calls.find((call) => call.url.includes('/rest/v1/academy_booking'))?.url).toContain('venue_id=eq.v1');
  });

  it('books for a company under the member with the contact\'s number, and says so when there is none', async () => {
    const contactPhone = indianMobileSchema.parse('9000000203');
    const booking = { batchId: 'b1', contactPhone, companyName: 'Acme Pvt Ltd', seats: 3, requestId: 'r1' };
    const found = renderStaffAcademy({ '/rest/v1/member': { body: [{ id: 'm203' }] }, '/rpc/book_academy_corporate': { body: 'k1' } });
    expect(await act(() => found.result.current.actions.bookCompany.mutateAsync(booking))).toEqual({ ok: true, value: null });
    expect(found.calls.find((call) => call.url.includes('/rpc/book_academy_corporate'))?.body).toEqual({
      p_batch_id: 'b1', p_member_id: 'm203', p_company_name: 'Acme Pvt Ltd', p_seats: 3, p_request_id: 'r1',
    });
    cleanup();

    const missing = renderStaffAcademy({ '/rest/v1/member': { body: [] } });
    expect(await act(() => missing.result.current.actions.bookCompany.mutateAsync(booking))).toEqual({ ok: false, error: 'no_member' });
  });

  it('says why the cage could not confirm a payment', async () => {
    const { result } = renderStaffAcademy({
      '/rpc/confirm_academy_payment': { status: 400, body: { code: 'RVUTM', message: 'The UTR found in the bank is not the one on this booking' } },
    });
    expect(await act(() => result.current.actions.confirmPayment.mutateAsync({ bookingId: 'k1', utr: '512345678901' }))).toEqual({
      ok: false, error: 'utr_mismatch',
    });
  });
});

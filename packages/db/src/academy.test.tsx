import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useAcademyActions, useAcademyBatches, useAcademyBookings, useAcademyPayment } from './academy.ts';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const ARJUN = '00000000-0000-4000-8000-000000000201';

/** A fake API: each path answers with its reply. */
function renderAcademy(replies: Record<string, { status?: number; body: unknown }>) {
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
    auth: { storage: sessionStorageFor(ARJUN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(
    () => ({ batches: useAcademyBatches(), bookings: useAcademyBookings(), payment: useAcademyPayment('k1'), actions: useAcademyActions() }),
    { wrapper },
  );
  return { result, calls };
}

afterEach(cleanup);

describe('Academy data', () => {
  it('gives the open batches, the member\'s bookings and what to pay, money in paise as bigint', async () => {
    const { result } = renderAcademy({
      '/rpc/academy_open_batches': { body: [{ id: 'b1', name: 'Level 1', starts_on: '2026-11-15', ends_on: '2026-11-17', seats_left: 4, fee: 200000 }] },
      '/rest/v1/academy_booking': { body: [{ id: 'k1', batch_id: 'b1', status: 'payment_claimed', amount: 200000, utr: '412345678901' }] },
      '/rpc/academy_payment_details': { body: { amount: 200000, upi_vpa: 'rivr.gurugram@icici', upi_payee_name: 'RIVR' } },
    });

    await waitFor(() => expect(result.current.batches.data).toEqual([
      { id: 'b1', name: 'Level 1', startsOn: '2026-11-15', endsOn: '2026-11-17', seatsLeft: 4, fee: 200000n },
    ]));
    await waitFor(() => expect(result.current.bookings.data).toEqual([
      { id: 'k1', batchId: 'b1', status: 'payment_claimed', amount: 200000n, utr: '412345678901' },
    ]));
    await waitFor(() => expect(result.current.payment.data).toEqual({ amount: 200000n, upiVpa: 'rivr.gurugram@icici', upiPayeeName: 'RIVR' }));
  });

  it('books a seat and gives the UTR, saying why when the database refuses', async () => {
    const { result, calls } = renderAcademy({
      '/rpc/academy_open_batches': { body: [] },
      '/rest/v1/academy_booking': { body: [] },
      '/rpc/book_academy': { body: 'k1' },
      '/rpc/claim_academy_payment': { status: 409, body: { code: '23505', message: 'duplicate key' } },
    });

    expect(await act(() => result.current.actions.book.mutateAsync('b1'))).toEqual({ ok: true, value: 'k1' });
    expect(await act(() => result.current.actions.claimPayment.mutateAsync({ bookingId: 'k1', utr: '412345678901' }))).toEqual({
      ok: false, error: 'utr_used',
    });
    expect(calls.find((call) => call.url.includes('/rpc/claim_academy_payment'))?.body).toEqual({ p_booking_id: 'k1', p_utr: '412345678901' });
  });
});

import { createRivrClient, RivrDataProvider, type StaffAcademyBooking } from '@rivr/db';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PaymentRow } from './PaymentRow.tsx';

// Kabir's seat, his UTR given and waiting for the cage.
const claimed: StaffAcademyBooking = {
  id: 'k1', batchId: 'b1', memberName: 'Kabir Sethi', companyName: null, seats: 1, amount: 200000n, status: 'payment_claimed',
  utr: '412345678901', recordedByStaffId: null,
};

/** The row for cashier s105, against a fake API that records each function called and its arguments. */
function renderRow(booking: StaffAcademyBooking) {
  const calls: { url: string; body: unknown }[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/')) calls.push({ url, body: JSON.parse(String(init?.body)) });
    return Response.json(null);
  });
  const client = createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' });
  const row = (shown: StaffAcademyBooking) => (
    <RivrDataProvider client={client}>
      <PaymentRow venueId="v1" staffId="s105" booking={shown} batchName="Level 1" />
    </RivrDataProvider>
  );
  const view = render(row(booking));
  return { calls, rerender: (shown: StaffAcademyBooking) => view.rerender(row(shown)) };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PaymentRow', () => {
  it('confirms the UTR the cashier looked for in the bank', async () => {
    const { calls } = renderRow(claimed);
    fireEvent.click(screen.getByRole('button', { name: 'Found in the bank' }));
    await waitFor(() => expect(calls.at(-1)).toMatchObject({
      url: expect.stringContaining('/rpc/confirm_academy_payment'), body: { p_booking_id: 'k1', p_utr: '412345678901' },
    }));
  });

  it('says so when the payer changes the UTR, and acts on the new one only once the cashier looks for it', async () => {
    const { calls, rerender } = renderRow(claimed);
    rerender({ ...claimed, utr: '698765432109' });
    expect(screen.getByText('UTR 412345678901')).toBeDefined();
    expect(screen.getByRole('alert').textContent).toBe('The payer changed this UTR to 698765432109. Look for the new one.');
    expect(screen.queryByRole('button', { name: 'Found in the bank' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Check the new UTR' }));
    expect(screen.getByText('UTR 698765432109')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Not in the bank' }));
    await waitFor(() => expect(calls.at(-1)).toMatchObject({
      url: expect.stringContaining('/rpc/reject_academy_payment'), body: { p_utr: '698765432109' },
    }));
  });

  it('never offers to confirm a UTR the cashier recorded themselves', () => {
    renderRow({ ...claimed, recordedByStaffId: 's105' });
    expect(screen.queryByRole('button', { name: 'Found in the bank' })).toBeNull();
    expect(screen.getByText('You recorded this UTR, so another staff member confirms it.')).toBeDefined();
  });
});

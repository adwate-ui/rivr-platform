import { createRivrClient, RivrDataProvider, type CageMember } from '@rivr/db';
import { fromRupees, ZERO } from '@rivr/domain/money';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BuyInForm } from './BuyInForm.tsx';

// Ishaan: verified, seated at Table 3 (₹10,000 minimum), with ₹2,00,000 in his wallet.
const ISHAAN: CageMember = {
  memberId: 'm211', fullName: 'Ishaan Verma', tierName: 'Member', isKycComplete: true, kycRefusal: null, photoPath: null,
  wallet: fromRupees(200_000n), bonus: ZERO, markers: ZERO, seat: { tableName: 'Table 3', number: 1, minimum: fromRupees(10_000n) },
  breakUntil: null, callTimeOwed: 0, isLetGoEarly: false,
};

/** What a buy-in was sent with: its request id and UTR. */
function sentWith(body: unknown) {
  if (typeof body !== 'object' || body === null || !('p_idempotency_key' in body) || !('p_utr' in body)) return null;
  return { requestId: body.p_idempotency_key, utr: body.p_utr };
}

const UTR_USED = 'That UTR already paid for another buy-in. Check the bank record.';
const NO_ANSWER = 'That did not go through. Check the connection and try again.';
const CHANGED = 'That request is not waiting for this member and amount.';

/** The cage refusing the UTR: an answer, so nothing was written. */
const refuseUtr = () => Response.json({ code: 'RVUTR', message: 'That UTR already paid something else at this venue' }, { status: 400 });

/** The form for Ishaan, against a fake API that answers the nth buy-in with `reply(n)` and keeps what each was sent. */
function renderForm(reply: (call: number) => Response = refuseUtr) {
  const sent: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.includes('/rpc/cage_buy_in')) return Response.json([]);
    sent.push(JSON.parse(String(init?.body)));
    return reply(sent.length);
  });
  const client = createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' });
  render(<RivrDataProvider client={client}><BuyInForm venueId="v1" member={ISHAAN} /></RivrDataProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'UPI' }));
  fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '10000' } });
  fireEvent.change(screen.getByLabelText('UTR'), { target: { value: '223456789012' } });
  return sent;
}

/** Taps Issue chips and waits for what the cashier is told. */
async function issue(sent: unknown[], told = UTR_USED) {
  const before = sent.length;
  fireEvent.click(screen.getByRole('button', { name: 'Issue chips' }));
  await waitFor(() => expect(sent).toHaveLength(before + 1));
  await screen.findByText(told);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('BuyInForm', () => {
  it('sends a retried tap with the same request id, so the chips are issued once', async () => {
    const sent = renderForm();
    await issue(sent);
    await issue(sent);
    const [first, retry] = sent.map(sentWith);
    expect(first?.utr).toBe('223456789012');
    expect(retry).toEqual(first);
  });

  it('sends a double tap with one request id, so it is one buy-in', async () => {
    const sent = renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Issue chips' }));
    fireEvent.click(screen.getByRole('button', { name: 'Issue chips' }));
    await waitFor(() => expect(sent).toHaveLength(2));
    const [first, second] = sent.map(sentWith);
    expect(first?.utr).toBe('223456789012');
    expect(second).toEqual(first);
  });

  it('keeps the request id after no answer, whatever is edited, so the cage refuses a changed try rather than issuing twice', async () => {
    const sent = renderForm(() => { throw new TypeError('Failed to fetch'); });
    await issue(sent, NO_ANSWER);
    fireEvent.change(screen.getByLabelText('UTR'), { target: { value: '223456789013' } });
    await issue(sent, NO_ANSWER);
    const [first, changed] = sent.map(sentWith);
    expect(changed?.utr).toBe('223456789013');
    expect(changed?.requestId).toBe(first?.requestId);
  });

  it('keeps the request id after the cage refuses a changed replay, so a second edit is no second buy-in', async () => {
    const sent = renderForm((call) => {
      if (call === 1) throw new TypeError('Failed to fetch');
      return Response.json({ code: '22023', message: 'That request id was used for another buy-in' }, { status: 400 });
    });
    await issue(sent, NO_ANSWER);
    fireEvent.change(screen.getByLabelText('UTR'), { target: { value: '223456789013' } });
    await issue(sent, CHANGED);
    fireEvent.change(screen.getByLabelText('UTR'), { target: { value: '223456789014' } });
    fireEvent.click(screen.getByRole('button', { name: 'Issue chips' }));
    await waitFor(() => expect(sent).toHaveLength(3));
    const [first, second, third] = sent.map(sentWith);
    expect(third?.utr).toBe('223456789014');
    expect([second?.requestId, third?.requestId]).toEqual([first?.requestId, first?.requestId]);
  });

  it('keeps the request id from a try with no answer until one goes through, whatever the cage refuses next', async () => {
    const sent = renderForm((call) => {
      if (call === 1) throw new TypeError('Failed to fetch');
      return refuseUtr();
    });
    await issue(sent, NO_ANSWER);
    await issue(sent, UTR_USED);
    fireEvent.change(screen.getByLabelText('UTR'), { target: { value: '223456789013' } });
    fireEvent.click(screen.getByRole('button', { name: 'Issue chips' }));
    await waitFor(() => expect(sent).toHaveLength(3));
    const [first, second, third] = sent.map(sentWith);
    expect(third?.utr).toBe('223456789013');
    expect([second?.requestId, third?.requestId]).toEqual([first?.requestId, first?.requestId]);
  });

  it('makes a new request id when the UTR changes after the cage refused, so another bank transfer is another buy-in', async () => {
    const sent = renderForm();
    await issue(sent);
    fireEvent.change(screen.getByLabelText('UTR'), { target: { value: '223456789013' } });
    await issue(sent);
    const [first, corrected] = sent.map(sentWith);
    expect(corrected?.utr).toBe('223456789013');
    expect(corrected?.requestId).not.toBe(first?.requestId);
  });

  it('keeps the request id when the cashier types the same UTR again, so it is the same buy-in', async () => {
    const sent = renderForm();
    await issue(sent);
    fireEvent.change(screen.getByLabelText('UTR'), { target: { value: '22345678901' } });
    fireEvent.change(screen.getByLabelText('UTR'), { target: { value: '223456789012' } });
    await issue(sent);
    const [first, retyped] = sent.map(sentWith);
    expect(first?.utr).toBe('223456789012');
    expect(retyped).toEqual(first);
  });
});

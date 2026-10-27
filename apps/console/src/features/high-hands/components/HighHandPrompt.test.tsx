import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, type HighHand } from '@rivr/db';
import { fromPaise } from '@rivr/domain/money';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HighHandPrompt } from './HighHandPrompt.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const CLAIM: HighHand = {
  claimId: 'c1', status: 'claimed', category: 'straight_flush', rank: null, seat: 4, tableName: 'Table 3', playedAt: '2026-11-15T22:18:00+05:30',
  payout: fromPaise(1000000n), dealerName: 'Pema Lepcha', decidedByName: null, reason: null, original: null, reversal: null,
};

/** Kavya, a duty manager, signed in, and a fake API that records each decision. */
function renderPrompt(waiting: number, onSeeAll = vi.fn()) {
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: '00000000-0000-4000-8000-000000000118', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
    }),
  );
  const sent: { url: string; body: unknown }[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/')) sent.push({ url, body: JSON.parse(String(init?.body)) });
    return Response.json(null);
  });
  const client = createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' });
  render(<RivrDataProvider client={client}><HighHandPrompt venueId="v1" hand={CLAIM} waiting={waiting} onSeeAll={onSeeAll} /></RivrDataProvider>);
  return sent;
}

describe('HighHandPrompt', () => {
  it('says what is claimed and approves it at the amount shown', async () => {
    const sent = renderPrompt(1);
    expect(screen.getByRole('alert').textContent).toContain('High hand claim · Table 3, seat 4 · Straight flush · ₹10,000');
    expect(screen.queryByRole('button', { name: /See all/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Approve ₹10,000' }));
    await waitFor(() => expect(sent).toEqual([
      { url: expect.stringContaining('/rpc/approve_high_hand'), body: { p_claim_id: 'c1', p_expected_paise: 1000000 } },
    ]));
  });

  it('rejects only with the reason, as on the High hands screen', async () => {
    const sent = renderPrompt(1);
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Why it is not approved' }), { target: { value: ' The board was misread ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reject the claim' }));
    await waitFor(() => expect(sent).toEqual([
      { url: expect.stringContaining('/rpc/reject_high_hand'), body: { p_claim_id: 'c1', p_reason: 'The board was misread' } },
    ]));
  });

  it('opens the High hands screen when more claims wait', () => {
    const onSeeAll = vi.fn();
    renderPrompt(3, onSeeAll);
    fireEvent.click(screen.getByRole('button', { name: 'See all 3' }));
    expect(onSeeAll).toHaveBeenCalledOnce();
  });
});

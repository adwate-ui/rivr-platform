import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useClaimHighHand, useHighHandActions, useHighHands, useTabletHighHands } from './highHands.ts';
import { toPaise } from './parse/hands.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const SIGNED_IN = '00000000-0000-4000-8000-000000000103';
const VENUE = '00000000-0000-4000-8000-000000000001';

/** A fake API: each path answers with its reply. */
function renderHighHands(replies: Record<string, { status?: number; body: unknown }>) {
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
    auth: { storage: sessionStorageFor(SIGNED_IN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(
    () => ({ mine: useTabletHighHands(), claim: useClaimHighHand(), list: useHighHands(VENUE), floor: useHighHandActions(VENUE) }),
    { wrapper },
  );
  return { result, calls };
}

const EMPTY = { '/rest/v1/high_hand_claim': { body: [] }, '/rpc/high_hands': { body: [] } };
const ROW = {
  claim_id: 'c1', status: 'claimed', category: 'straight_flush', rank: null, seat: 4, table_name: 'Table 3', played_at: '2026-10-19T22:18:00+05:30',
  payout_paise: 1000000, dealer_name: 'Pema Lepcha', decided_by_name: null, decided_at: null, reason: null,
};

afterEach(cleanup);

describe('High hands', () => {
  it('claims a straight flush at seat 4 for a hand, and says when that hand does not pay', async () => {
    const paid = renderHighHands({ ...EMPTY, '/rpc/claim_high_hand': { body: 'c1' } });
    let outcome: unknown;
    await act(async () => { outcome = await paid.result.current.claim.mutateAsync({ handId: 'h1', seat: 4, category: 'straight_flush', rank: null }); });
    expect(outcome).toEqual({ ok: true, value: 'c1' });
    expect(paid.calls.find((call) => call.url.includes('claim_high_hand'))?.body).toEqual({ p_hand_id: 'h1', p_seat: 4, p_category: 'straight_flush', p_rank: '' });
    cleanup();
    const unpaid = renderHighHands({ ...EMPTY, '/rpc/claim_high_hand': { status: 400, body: { code: '22023', message: 'That high hand pays nothing here' } } });
    await act(async () => { outcome = await unpaid.result.current.claim.mutateAsync({ handId: 'h2', seat: 2, category: 'four_of_a_kind', rank: 'Q' }); });
    expect(outcome).toEqual({ ok: false, error: 'not_paying' });
  });

  it('lists the tablet\'s claims and the venue\'s high hands with what each pays', async () => {
    const { result } = renderHighHands({
      '/rest/v1/high_hand_claim': { body: [{ id: 'c1', hand_id: 'h1', category: 'straight_flush', seat: 4, status: 'claimed' }] },
      '/rpc/high_hands': { body: [ROW, { ...ROW, claim_id: 'c2', status: 'rejected', payout_paise: null, reason: 'Misread' }] },
    });
    await waitFor(() => expect(result.current.mine.data).toEqual([{ claimId: 'c1', handId: 'h1', category: 'straight_flush', seat: 4, status: 'claimed' }]));
    await waitFor(() => expect(result.current.list.data?.map((hand) => [hand.claimId, hand.payout, hand.reason])).toEqual([
      ['c1', toPaise(1000000), null], ['c2', null, 'Misread'],
    ]));
  });

  it('approves at the amount shown, says when it changed, and rejects with the reason', async () => {
    const { result, calls } = renderHighHands({
      ...EMPTY,
      '/rpc/approve_high_hand': { status: 400, body: { code: 'RVSTL', message: 'changed' } },
      '/rpc/reject_high_hand': { body: null },
    });
    let outcome: unknown;
    await act(async () => { outcome = await result.current.floor.approve.mutateAsync({ claimId: 'c1', payout: toPaise(1000000) }); });
    expect(outcome).toEqual({ ok: false, error: 'changed' });
    expect(calls.find((call) => call.url.includes('approve_high_hand'))?.body).toEqual({ p_claim_id: 'c1', p_expected_paise: 1000000 });
    await act(async () => { outcome = await result.current.floor.reject.mutateAsync({ claimId: 'c1', reason: ' Misread the board ' }); });
    expect(outcome).toEqual({ ok: true, value: null });
    expect(calls.find((call) => call.url.includes('reject_high_hand'))?.body).toEqual({ p_claim_id: 'c1', p_reason: 'Misread the board' });
  });
});

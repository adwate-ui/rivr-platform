import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import { QueryClient } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database, Json } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';
import { useTvSignals } from './tvBoards.ts';
import { toTvHighHand, useTvHighHand } from './tvHighHand.ts';

const TV = '00000000-0000-4000-8000-00000000e451';
const REWARD = {
  kind: 'high_hand', rules: { bothHoleCards: true, shownAtShowdown: true, minPlayersDealt: 4 },
  hands: [{ hand: 'royal_flush', chips: 25_000 }, { hand: 'four_of_a_kind', chips: 5_000 }],
};
const payout = (more: { [key: string]: Json } = {}): Json => ({
  id: 'h2', at: '2026-11-15T21:13:00+00:00', hand: 'four_of_a_kind', rank: 'jack', chips: 5_000, table: 'Table 2', name: 'Devansh M.', member_number: null, ...more,
});
const row = (payouts: Json) => ({ promotion_id: 'p9', name: 'High hand bonus', reward: REWARD, payouts });

function renderBoard(reply: { status?: number; body: unknown }) {
  const fetch: typeof globalThis.fetch = async () => Response.json(reply.body, { status: reply.status ?? 200 });
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(TV), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client} queryClient={queryClient}>{children}</RivrDataProvider>;
  return renderHook(() => useTvHighHand(), { wrapper }).result;
}

afterEach(cleanup);

describe('the TV\'s High hand bonus board (redesign RD-25)', () => {
  it('reads the hands, the rules and tonight\'s payouts, a hidden member by number', async () => {
    const result = renderBoard({ body: [row([payout(), payout({ id: 'h1', hand: 'royal_flush', rank: null, chips: 25_000, name: null, member_number: 1042 })])] });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toMatchObject({ promotionId: 'p9', name: 'High hand bonus', reward: REWARD });
    expect(result.current.data?.payouts).toEqual([
      { id: 'h2', at: '2026-11-15T21:13:00+00:00', hand: 'four_of_a_kind', rank: 'jack', chips: 5_000, table: 'Table 2', name: 'Devansh M.', memberNumber: null },
      { id: 'h1', at: '2026-11-15T21:13:00+00:00', hand: 'royal_flush', rank: null, chips: 25_000, table: 'Table 2', name: null, memberNumber: 1042 },
    ]);
  });

  it('is no board while no high hand runs, so the TV moves on', async () => {
    const result = renderBoard({ body: [] });
    await waitFor(() => expect(result.current.data).toBeNull());
  });

  it('drops what it cannot read: a payout that is not one, and a reward that is no high hand', () => {
    expect(toTvHighHand([row(['not a payout', { id: 'h3' }, payout()])])?.payouts).toHaveLength(1);
    expect(toTvHighHand([row('none')])?.payouts).toEqual([]);
    expect(toTvHighHand([{ ...row([]), reward: { kind: 'seat_bonus', chips: 1_000 } }])).toBeNull();
  });

  it('fails when the database refuses it', async () => {
    const result = renderBoard({ status: 400, body: { code: '42501', message: 'refused', details: null, hint: null } });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('the board live (redesign RD-25)', () => {
  it('reads the board again two seconds after a payout\'s signal on the venue\'s TV topic', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let reads = 0;
    const fetch: typeof globalThis.fetch = async () => { reads += 1; return Response.json([row([])]); };
    const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
      global: { fetch },
      auth: { storage: sessionStorageFor(TV), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const channels: RealtimeChannel[] = [];
    const openChannel = client.channel.bind(client);
    vi.spyOn(client, 'channel').mockImplementation((name, options) => {
      const channel = openChannel(name, options);
      vi.spyOn(channel, 'on');
      // No socket in tests: subscribing does nothing, and the test fires the signal itself.
      vi.spyOn(channel, 'subscribe').mockReturnValue(channel);
      channels.push(channel);
      return channel;
    });
    vi.spyOn(client, 'removeChannel').mockResolvedValue('ok');
    const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
    renderHook(() => { useTvSignals('v1'); return useTvHighHand(); }, { wrapper });
    await waitFor(() => expect(channels.map((channel) => channel.topic)).toContain('realtime:tv:v1'));
    await waitFor(() => expect(reads).toBe(1));
    const tv = channels.find((channel) => channel.topic === 'realtime:tv:v1');
    const paid = vi.mocked(tv?.on)?.mock.calls.find(([type, filter]) => String(type) === 'broadcast' && JSON.stringify(filter).includes('high_hand'))?.[2];
    if (paid === undefined) throw new Error('No handler for a payout\'s signal');
    act(() => { paid({ type: 'broadcast', event: 'high_hand', payload: {} }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2_100); });
    await waitFor(() => expect(reads).toBe(2));
    vi.useRealTimers();
  });
});

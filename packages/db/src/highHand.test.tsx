import { createClient } from '@supabase/supabase-js';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { toHighHandTonight, useHighHandTonight } from './highHand.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const SIGNED_IN = '00000000-0000-4000-8000-000000000101';
const CLUB = '00000000-0000-4000-8000-000000000001';

/** A row of high_hand_tonight: Devansh's four Jacks at Table 2, the newest of two hands paid tonight. */
const row = (more: Record<string, unknown> = {}) => ({
  hit_id: 'h2', logged_at: '2026-11-15T21:13:00+00:00', member_id: 'm1', member_name: 'Devansh Malik', table_name: 'Table 2', seat: 3,
  hand: 'four_of_a_kind', rank: 'jack', chips: 5_000, logged_by: 'Farid Khan', paid_count: 2, paid_chips: 15_000, ...more,
});

function renderTonight(reply: { status?: number; body: unknown }, promotionId: string | null = null) {
  const asked: unknown[] = [];
  const fetch: typeof globalThis.fetch = async (_input, init) => {
    asked.push(JSON.parse(String(init?.body)));
    return Response.json(reply.body, { status: reply.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(SIGNED_IN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  // No retries, so a refusal is an error at once.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client} queryClient={queryClient}>{children}</RivrDataProvider>;
  return { result: renderHook(() => useHighHandTonight(CLUB, promotionId), { wrapper }).result, asked };
}

afterEach(cleanup);

describe('tonight\'s high hands (redesign RD-23)', () => {
  it('reads the night\'s count and Bonus, and the latest fifty hits, newest first', async () => {
    const { result, asked } = renderTonight({ body: [row(), row({ hit_id: 'h1', hand: 'straight_flush', rank: 'nine', seat: 1, chips: 10_000 })] });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(asked).toEqual([{ p_venue_id: CLUB, p_limit: 50 }]);
    expect(result.current.data).toMatchObject({ handsPaid: 2, chipsPaid: 15_000 });
    expect(result.current.data?.hits).toEqual([
      { id: 'h2', at: '2026-11-15T21:13:00+00:00', memberId: 'm1', memberName: 'Devansh Malik', tableName: 'Table 2', seat: 3, hand: 'four_of_a_kind',
        rank: 'jack', chips: 5_000, loggedBy: 'Farid Khan' },
      expect.objectContaining({ id: 'h1', hand: 'straight_flush', rank: 'nine', seat: 1, chips: 10_000 }),
    ]);
  });

  it('asks for one promotion\'s hits alone on its record', async () => {
    const { result, asked } = renderTonight({ body: [row()] }, 'p9');
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(asked).toEqual([{ p_venue_id: CLUB, p_limit: 50, p_promotion_id: 'p9' }]);
  });

  it('counts every hit of the night, though it lists the latest only', () => {
    expect(toHighHandTonight([row({ paid_count: 61, paid_chips: 3_05_000 })])).toMatchObject({ handsPaid: 61, chipsPaid: 305_000 });
  });

  it('is nothing paid while no hand was logged, and fails when the database refuses', async () => {
    expect(toHighHandTonight([])).toEqual({ handsPaid: 0, chipsPaid: 0, hits: [] });
    const { result } = renderTonight({ status: 400, body: { code: '42501', message: 'refused', details: null, hint: null } });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

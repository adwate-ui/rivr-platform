import { createClient } from '@supabase/supabase-js';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { nextRulesCheck, useDownHands, useTableRules } from './hands.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const TABLET = '00000000-0000-4000-8000-00000000e001';

/** A fake API: each path answers with its reply. The tablet is fixed to `ids.table`, during `ids.down`. */
function renderHands(replies: Record<string, { status?: number; body: unknown }>, ids: { table: string | null; down: string | null } = { table: 'table-3', down: 'down-1' }) {
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
    auth: { storage: sessionStorageFor(TABLET), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({ rules: useTableRules(ids.table), hands: useDownHands(ids.down) }), { wrapper });
  return { result, calls };
}

const RULES = { rate_basis_points: 500, cap_paise: 600000, is_jackpot_live: true, drop_paise: 10000, drop_above_paise: 500000, has_variation: true, next_change_at: null };
const EMPTY = { '/rpc/tablet_rake_rules': { body: [RULES] }, '/rpc/down_hands': { body: [] } };

afterEach(cleanup);

describe('When the tablet asks for its rules again', () => {
  const NOW = Date.parse('2026-11-15T20:00:00+05:30');
  it('is a minute with no change scheduled, or a change more than a minute away', () => {
    expect(nextRulesCheck(null, NOW)).toBe(60_000);
    expect(nextRulesCheck('2026-11-15T20:05:00+05:30', NOW)).toBe(60_000);
  });

  it('is half a second after a change due within the minute', () => {
    expect(nextRulesCheck('2026-11-15T20:00:10+05:30', NOW)).toBe(10_500);
  });

  it('is never sooner than a second, even for a change already due', () => {
    expect(nextRulesCheck('2026-11-15T19:59:00+05:30', NOW)).toBe(1_000);
  });
});

describe('Hand entry data', () => {
  it('gives the table\'s rules as @rivr/domain RakeRules, money in paise as bigint', async () => {
    const { result } = renderHands(EMPTY);
    await waitFor(() => expect(result.current.rules.data).toEqual({
      rake: { rateBasisPoints: 500n, cap: 600000n, isJackpotLive: true, drop: 10000n, dropAbove: 500000n },
      hasVariation: true,
      nextChangeAt: null,
    }));
  });

  it('asks again just after a scheduled change starts, not a minute later', async () => {
    const changeAt = new Date(Date.now() + 200).toISOString();
    const replies: Record<string, { body: unknown }> = { ...EMPTY, '/rpc/tablet_rake_rules': { body: [{ ...RULES, next_change_at: changeAt }] } };
    const { result, calls } = renderHands(replies);
    await waitFor(() => expect(result.current.rules.data?.nextChangeAt).toBe(changeAt));
    // The change starts: the rate goes up to 6%.
    replies['/rpc/tablet_rake_rules'] = { body: [{ ...RULES, rate_basis_points: 600 }] };
    await waitFor(() => expect(result.current.rules.data?.rake.rateBasisPoints).toBe(600n), { timeout: 3_000 });
    expect(calls.filter((call) => call.url.includes('/rpc/tablet_rake_rules'))).toHaveLength(2);
  });

  it('gives the down\'s hands, latest first as the database orders them', async () => {
    const { result } = renderHands({
      ...EMPTY,
      '/rpc/down_hands': { body: [{ hand_id: 'h1', played_at: '2026-10-19T21:05:00+05:30', variant: 'plo', pot_paise: 14000000,
        rake_paise: 600000, drop_paise: 10000, is_cap_applied: true }] },
    });
    await waitFor(() => expect(result.current.hands.data).toEqual([
      { handId: 'h1', playedAt: '2026-10-19T21:05:00+05:30', variant: 'plo', pot: 14000000n, rake: 600000n, drop: 10000n, isCapApplied: true },
    ]));
  });

  it('asks for nothing until the tablet is fixed to a table and a down is open', async () => {
    const { result, calls } = renderHands(EMPTY, { table: null, down: null });
    await waitFor(() => expect(result.current.rules.fetchStatus).toBe('idle'));
    expect(result.current.rules.isPending).toBe(true);
    expect(result.current.hands.fetchStatus).toBe('idle');
    expect(calls.filter((call) => call.url.includes('/rpc/'))).toEqual([]);
  });
});

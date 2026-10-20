import { fromPaise } from '@rivr/domain/money';
import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';
import { useChipInventory, useTreasury, useTreasuryActions } from './treasury.ts';

const STAFF = '00000000-0000-4000-8000-000000000104';
const VENUE = '00000000-0000-4000-8000-000000000001';
const BALANCES = {
  wallets_paise: 141_150_000, withdrawals_pending_paise: 2_500_000, bonus_paise: 400_000, markers_paise: 28_500_000, jackpots_paise: 34_260_000,
  chips_in_play_paise: 9_800_000,
};

/** A fake API: each RPC answers with its reply; every call is kept with what it was sent. */
function renderTreasury(replies: Record<string, { status?: number; body: unknown }>) {
  const calls: { rpc: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const rpc = (input instanceof Request ? input.url : String(input)).split('/rpc/')[1] ?? '';
    calls.push({ rpc, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const reply = replies[rpc];
    return Response.json(reply?.body ?? [], { status: reply?.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(STAFF), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({ treasury: useTreasury(VENUE), chips: useChipInventory(VENUE), actions: useTreasuryActions(VENUE) }), { wrapper });
  return { result, calls };
}

afterEach(cleanup);

describe('Treasury', () => {
  it('gives what the venue holds and the open shift\'s float', async () => {
    const { result } = renderTreasury({ treasury: { body: [{
      ...BALANCES, shift_id: 's1', float_paise: 120_000_000, opened_at: '2026-10-20T12:30:00Z', opened_by: 'Sana Qureshi',
    }] } });
    await waitFor(() => expect(result.current.treasury.data).toEqual({
      wallets: 141_150_000n, withdrawalsPending: 2_500_000n, bonus: 400_000n, markers: 28_500_000n, jackpots: 34_260_000n, chipsInPlay: 9_800_000n,
      shift: { shiftId: 's1', float: 120_000_000n, openedAt: '2026-10-20T12:30:00Z', openedBy: 'Sana Qureshi' },
    }));
  });

  it('has no shift before one opens', async () => {
    const { result } = renderTreasury({ treasury: { body: [{ ...BALANCES, shift_id: null, float_paise: null, opened_at: null, opened_by: null }] } });
    await waitFor(() => expect(result.current.treasury.data?.shift).toBeNull());
    expect(result.current.treasury.data?.chipsInPlay).toBe(9_800_000n);
  });
});

describe('Chip inventory', () => {
  it('gives each chip with the latest count, and what the cage holds', async () => {
    const counted = { in_cage_paise: 2_500_000, counted_at: '2026-10-20T12:30:00Z', counted_by: 'Sana Qureshi' };
    const { result } = renderTreasury({ chip_inventory: { body: [
      { value_paise: 5000, name: '₹50', quantity: 400, line_paise: 2_000_000, ...counted },
      { value_paise: 50000, name: '₹500', quantity: 1, line_paise: 50_000, ...counted },
    ] } });
    await waitFor(() => expect(result.current.chips.data).toEqual({
      lines: [{ value: 5000n, name: '₹50', quantity: 400, total: 2_000_000n }, { value: 50000n, name: '₹500', quantity: 1, total: 50_000n }],
      inCage: 2_500_000n, countedAt: '2026-10-20T12:30:00Z', countedBy: 'Sana Qureshi',
    }));
  });

  it('gives the chips with no count before one', async () => {
    const { result } = renderTreasury({ chip_inventory: { body: [
      { value_paise: 5000, name: '₹50', quantity: null, line_paise: null, in_cage_paise: null, counted_at: null, counted_by: null },
    ] } });
    await waitFor(() => expect(result.current.chips.data).toEqual({
      lines: [{ value: 5000n, name: '₹50', quantity: null, total: null }], inCage: null, countedAt: null, countedBy: null,
    }));
  });
});

describe('The cage\'s steps', () => {
  it('opens a shift with the float and every chip counted, once per request id', async () => {
    const { result, calls } = renderTreasury({ open_cage_shift: { body: 's1' } });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.actions.openShift.mutateAsync({
        float: fromPaise(120_000_000n), counts: [{ value: fromPaise(5000n), quantity: 400 }], requestId: 'r1',
      });
    });
    expect(outcome).toEqual({ ok: true, value: null });
    expect(calls.find((call) => call.rpc === 'open_cage_shift')?.body).toEqual({
      p_venue_id: VENUE, p_float_paise: 120000000, p_counts: [{ value_paise: 5000, quantity: 400 }], p_idempotency_key: 'r1',
    });
  });

  it.each([['RVSHO', 'shift_open'], ['RVNSH', 'no_shift'], ['22023', 'invalid'], ['42501', 'not_allowed'], ['XX000', 'unavailable']])(
    'says why a count is refused: %s is %s', async (code, failure) => {
      const { result } = renderTreasury({ count_chips: { status: 400, body: { code, message: 'refused' } } });
      let outcome: unknown;
      await act(async () => {
        outcome = await result.current.actions.countChips.mutateAsync({ counts: [{ value: fromPaise(5000n), quantity: 0 }], requestId: 'r2' });
      });
      expect(outcome).toEqual({ ok: false, error: failure });
    },
  );
});

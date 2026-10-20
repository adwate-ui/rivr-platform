import { createClient } from '@supabase/supabase-js';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';
import { useWallet, useWalletMovements } from './wallet.ts';

const ARJUN = '00000000-0000-4000-8000-000000000201';

/** A fake API answering my_wallet and each table or view by its name; every URL asked is kept. */
function renderWallet(tables: Record<string, unknown[]>, count = 2) {
  const urls: string[] = [];
  const fetch: typeof globalThis.fetch = async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    urls.push(decodeURIComponent(url));
    if (url.includes('/rpc/my_wallet')) return Response.json(tables.my_wallet ?? []);
    const name = url.split('/rest/v1/')[1]?.split('?')[0] ?? '';
    return Response.json(tables[name] ?? []);
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(ARJUN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({ wallet: useWallet(), movements: useWalletMovements(count) }), { wrapper });
  return { result, urls };
}

afterEach(cleanup);

/** Waits for the wallet to load and gives the hooks' state. */
async function settle({ result }: ReturnType<typeof renderWallet>) {
  await waitFor(() => expect(result.current.wallet.isSuccess).toBe(true));
  return result.current;
}

describe('Wallet', () => {
  it('gives Arjun\'s cash, bonus in force, points, open markers and limit, reading only his own grants and markers', async () => {
    const { result, urls } = renderWallet({
      my_wallet: [{ member_id: ARJUN, cash_paise: 18_500_000, points: 18_420, credit_limit_paise: 20_000_000 }],
      bonus_grant: [{ id: 'g1', remaining_paise: 400_000, expires_at: '2026-11-22T18:29:00+00:00' }],
      marker: [{ id: 'm1', outstanding_paise: 5_000_000, issued_at: '2026-10-06T12:00:00+00:00', due_at: '2026-11-05T12:00:00+00:00' }],
    });
    await waitFor(() => expect(result.current.wallet.data).toEqual({
      cash: 18_500_000n, points: 18_420n, creditLimit: 20_000_000n,
      bonus: [{ grantId: 'g1', remaining: 400_000n, expiresAt: '2026-11-22T18:29:00+00:00' }],
      markers: [{ markerId: 'm1', outstanding: 5_000_000n, issuedAt: '2026-10-06T12:00:00+00:00', dueAt: '2026-11-05T12:00:00+00:00' }],
    }));
    expect(urls.find((url) => url.includes('/bonus_grant'))).toContain(`member_id=eq.${ARJUN}`);
    expect(urls.find((url) => url.includes('/bonus_grant'))).toContain('expired_at=is.null');
    expect(urls.find((url) => url.includes('/marker'))).toContain('settled_at=is.null');
  });

  it('is null for someone signed in who is not a member, and has no limit without a credit line', async () => {
    expect((await settle(renderWallet({ my_wallet: [] }))).wallet.data).toBeNull();
    const noLine = await settle(renderWallet({ my_wallet: [{ member_id: ARJUN, cash_paise: 0, points: 0, credit_limit_paise: null }] }));
    expect(noLine.wallet.data?.creditLimit).toBeNull();
  });
});

describe('Wallet movements', () => {
  const row = (id: number, kind: string, account: string, amount: number) => ({
    id, at: '2026-10-20T15:00:00+00:00', kind, account, amount, table_name: null, bonus_reason: null, bank_name: null,
  });

  it('gives the newest lines, newest first, asking one more to know whether earlier ones remain', async () => {
    const { result, urls } = renderWallet({
      my_wallet_movement: [row(3, 'buy_in', 'cash', -1_000_000), row(2, 'promo_spin', 'bonus', 100_000), row(1, 'opening_balance', 'cash', 5_000_000)],
    });
    await waitFor(() => expect(result.current.movements.data?.hasEarlier).toBe(true));
    expect(result.current.movements.data?.movements).toEqual([
      { id: '3', at: '2026-10-20T15:00:00+00:00', kind: 'buy_in', account: 'cash', amount: -1_000_000n, tableName: null, bonusReason: null, bankName: null },
      { id: '2', at: '2026-10-20T15:00:00+00:00', kind: 'other', account: 'bonus', amount: 100_000n, tableName: null, bonusReason: null, bankName: null },
    ]);
    const asked = urls.find((url) => url.includes('/my_wallet_movement')) ?? '';
    expect(asked).toContain('order=at.desc,id.desc');
    expect(asked).toContain('limit=3');
  });

  it('says nothing earlier remains when no more lines than asked come back, and skips a line on no money account it knows', async () => {
    const { result } = renderWallet({ my_wallet_movement: [row(2, 'opening_balance', 'points', 18_420), row(1, 'marker', 'receivable', 5_000_000)] });
    await waitFor(() => expect(result.current.movements.data?.hasEarlier).toBe(false));
    expect(result.current.movements.data?.movements.map((movement) => movement.account)).toEqual(['receivable']);
  });
});

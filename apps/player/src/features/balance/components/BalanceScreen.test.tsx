import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BalanceScreen } from './BalanceScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const ARJUN = '00000000-0000-4000-8000-000000000201';
const WALLET = [{ member_id: ARJUN, cash_paise: 18_500_000, points: 18_420, credit_limit_paise: 20_000_000 }];
const MARKER = { id: 'm1', outstanding_paise: 5_000_000, issued_at: '2026-10-06T12:00:00+00:00', due_at: '2026-11-05T12:00:00+00:00' };
/** A line of Arjun's at Table 2. */
const line = (id: number, kind: string, account: string, amount: number) => ({
  id, at: '2026-10-13T16:00:00+00:00', kind, account, amount, table_name: 'Table 2', bonus_reason: null,
});

interface Api {
  /** How my_wallet answers: Arjun's row, a failure, or never (still loading). */
  wallet?: 'arjun' | 'fails' | 'never';
  movements?: unknown[];
}

/** Arjun signed in, and a fake API for his Balance; `answer` changes how my_wallet answers from then on. */
function renderBalance(api: Api) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: ARJUN, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  let wallet = api.wallet ?? 'arjun';
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/my_wallet')) {
      if (wallet === 'never') return new Promise<Response>(() => undefined);
      return wallet === 'fails' ? Response.json({ message: 'down' }, { status: 503 }) : Response.json(WALLET);
    }
    if (url.includes('/marker')) return Response.json([MARKER]);
    if (url.includes('/my_wallet_movement')) return Response.json(api.movements ?? []);
    return Response.json([]);
  });
  // No retries, so a failure shows at once.
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })} queryClient={cache}>
      <BalanceScreen />
    </RivrDataProvider>,
  );
  return { answer: (next: 'arjun' | 'fails') => { wallet = next; } };
}

describe('Balance', () => {
  it('says it is loading until the wallet comes', async () => {
    renderBalance({ wallet: 'never' });
    expect(await screen.findByRole('status')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Balance' })).toBeDefined();
  });

  it('shows cash, points and markers against the limit, and "No movements yet." with none', async () => {
    renderBalance({});
    expect(await screen.findByText('₹1,85,000')).toBeDefined();
    expect(screen.getByText('18,420 points')).toBeDefined();
    expect(screen.getByText('Limit ₹2,00,000 · available ₹1,50,000')).toBeDefined();
    expect(screen.getByText('No movements yet.')).toBeDefined();
  });

  it('says it could not load, and loads on Try again', async () => {
    const api = renderBalance({ wallet: 'fails' });
    const retry = await screen.findByRole('button', { name: 'Try again' });
    api.answer('arjun');
    fireEvent.click(retry);
    expect(await screen.findByText('₹1,85,000')).toBeDefined();
  });

  it('lists movements with where they happened: a cash-out to the wallet, the marker it repaid, a buy-in', async () => {
    renderBalance({
      movements: [line(3, 'cash_out', 'cash', 2_000_000), line(2, 'cash_out', 'receivable', -5_000_000), line(1, 'buy_in', 'cash', -2_000_000)],
    });
    expect(await screen.findByText('+₹20,000')).toBeDefined();
    expect(screen.getAllByText('Cash-out · Table 2')).toHaveLength(2);
    expect(screen.getByText('₹50,000 repaid')).toBeDefined();
    expect(screen.getByText('Buy-in · Table 2')).toBeDefined();
    expect(screen.getByText('−₹20,000')).toBeDefined();
    expect(screen.queryByText('No movements yet.')).toBeNull();
  });
});

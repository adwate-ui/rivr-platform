import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BalanceScreen } from './BalanceScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const ARJUN = '00000000-0000-4000-8000-000000000201';
const WALLET = [{ member_id: ARJUN, cash_paise: 18_500_000, points: 18_420, credit_limit_paise: 20_000_000 }];
const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY).toISOString();
// A marker issued a fortnight ago, due in a fortnight: not past due, whatever day the tests run.
const MARKER = { id: 'm1', outstanding_paise: 5_000_000, issued_at: daysFromNow(-14), due_at: daysFromNow(16) };
const PAYOUT = {
  id: 'p1', kind: 'upi', bank_name: 'HDFC Bank', vpa: 'arjun.mehta@hdfcbank', account_number: null, ifsc: null, holder_name: null, status: 'verified',
  reject_reason: null,
};
/** What each table answers. */
const TABLES: Readonly<Record<string, unknown>> = { 'rpc/my_payout_accounts': [PAYOUT] };

/** How my_wallet answers: Arjun's row, a failure, or never. */
function walletAnswer(wallet: 'arjun' | 'fails' | 'never'): Promise<Response> | Response {
  if (wallet === 'never') return new Promise<Response>(() => undefined);
  return wallet === 'fails' ? Response.json({ message: 'down' }, { status: 503 }) : Response.json(WALLET);
}

/** A line of Arjun's at Table 2. */
const line = (id: number, kind: string, account: string, amount: number) => ({
  id, at: '2026-10-13T16:00:00+00:00', kind, account, amount, table_name: 'Table 2', bonus_reason: null,
});

interface Api {
  /** How my_wallet answers: Arjun's row, a failure, or never (still loading). */
  wallet?: 'arjun' | 'fails' | 'never';
  movements?: unknown[];
  /** The member's open markers: one due in a fortnight unless given. */
  markers?: unknown[];
}

/** Arjun signed in, and a fake API for his Balance; `answer` changes how my_wallet answers from then on, and `added` keeps each account added. */
function renderBalance(api: Api) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: ARJUN, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  let wallet = api.wallet ?? 'arjun';
  const added: unknown[] = [];
  const tables: Readonly<Record<string, unknown>> = { ...TABLES, marker: api.markers ?? [MARKER] };
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/my_wallet')) return walletAnswer(wallet);
    if (url.includes('/rpc/add_payout_account')) {
      added.push(JSON.parse(String(init?.body)));
      return Response.json('p2');
    }
    if (url.includes('/my_wallet_movement')) return Response.json(api.movements ?? []);
    return Response.json(tables[url.split('/rest/v1/')[1]?.split('?')[0] ?? ''] ?? []);
  });
  // No retries, so a failure shows at once.
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })} queryClient={cache}>
      <BalanceScreen />
    </RivrDataProvider>,
  );
  return { answer: (next: 'arjun' | 'fails') => { wallet = next; }, added };
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

  it('says a marker past its due date is overdue, and that no new credit is given until it is settled', async () => {
    // The clock pinned past the due date, so the day the tests run changes nothing.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-20T12:00:00Z'));
    renderBalance({ markers: [{ ...MARKER, issued_at: '2026-10-06T12:00:00Z', due_at: '2026-11-05T12:00:00Z' }] });
    expect(await screen.findByText('Issued 6 Oct · overdue since 5 Nov')).toBeDefined();
    expect(screen.getByText('Limit ₹2,00,000 · no new credit until overdue markers are settled')).toBeDefined();
    expect(screen.queryByText(/available/)).toBeNull();
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

  it('shows Arjun\'s verified HDFC Bank UPI among his payout accounts', async () => {
    renderBalance({});
    expect(await screen.findByText('HDFC Bank · UPI arjun.mehta@hdfcbank')).toBeDefined();
    expect(screen.getByText('Verified')).toBeDefined();
  });

  it('adds a bank account, saying first what is wrong field by field, then that the cage verifies it', async () => {
    const api = renderBalance({});
    fireEvent.click(await screen.findByRole('button', { name: 'Add a payout account' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bank account' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add account' }));
    expect(await screen.findByText('Enter the account number: 9 to 18 digits.')).toBeDefined();
    expect(screen.getByText('Enter the 11-character IFSC, such as HDFC0001234.')).toBeDefined();
    expect(screen.getByText('Enter the bank\'s name.')).toBeDefined();
    fireEvent.change(screen.getByRole('textbox', { name: 'Bank' }), { target: { value: 'ICICI Bank' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Account number' }), { target: { value: '001234567890' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'IFSC' }), { target: { value: 'icic0000123' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Name on the account' }), { target: { value: 'Arjun Mehta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add account' }));
    expect(await screen.findByText('Added. The cage verifies it before you can withdraw to it.')).toBeDefined();
    expect(api.added).toEqual([{ p_kind: 'bank', p_bank_name: 'ICICI Bank', p_account_number: '001234567890', p_ifsc: 'ICIC0000123', p_holder_name: 'Arjun Mehta' }]);
  });
});
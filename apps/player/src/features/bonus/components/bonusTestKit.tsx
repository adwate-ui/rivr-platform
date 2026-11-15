import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { ToastProvider } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { BonusScreen } from './BonusScreen.tsx';

const FEATURES = ['referral.share_cards', 'rewards.bonus'].map((feature_key) => ({ feature_key, state: 'enabled', tiers: null }));
/** Meera's Bonus (decision 0504): 1,250 left after a 1,500 welcome and 1,000 used at Table 3. */
export const BONUS_LINES = [
  { line_id: 'b2', at: '2026-11-15T18:00:00Z', kind: 'redeemed', amount_paise: 100_000, reason: null, table_name: 'Table 3' },
  { line_id: 'b1', at: '2026-11-14T18:00:00Z', kind: 'credited', amount_paise: 150_000, reason: 'Welcome bonus', table_name: null },
];
/** What the API answers: the balance in paise, `down` for a failed read, `none` for someone who is no member; and the lines. */
interface BonusReplies { balance: number | 'down' | 'none'; lines: readonly unknown[]; isEarlierDown?: boolean }

const DOWN = () => Response.json({ code: 'XX000', message: 'down' }, { status: 500 });

/** The balance's reply, or the history's, kept as asked for; undefined for any other path. */
function bonusReply(url: string, body: string, bonus: BonusReplies, historyAsked: unknown[]): Response | undefined {
  if (url.includes('/rpc/my_bonus_history')) {
    historyAsked.push(JSON.parse(body));
    return bonus.isEarlierDown === true && historyAsked.length > 1 ? DOWN() : Response.json(bonus.lines);
  }
  if (!url.includes('/rpc/my_bonus')) return undefined;
  if (bonus.balance === 'down') return DOWN();
  return Response.json(bonus.balance === 'none' ? [] : [{ bonus_paise: bonus.balance }]);
}

/** Meera signed in on Bonus, with Refer a friend; `historyAsked` keeps each read of her history. */
export function renderBonus(bonus: BonusReplies = { balance: 125_000, lines: BONUS_LINES }) {
  const historyAsked: unknown[] = [];
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000231', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const answer = bonusReply(url, String(init?.body ?? '{}'), bonus, historyAsked);
    if (answer !== undefined) return answer;
    if (url.includes('/rpc/my_feature_access')) return Response.json(FEATURES);
    if (url.includes('/rpc/my_referral')) return Response.json([{ code: 'RIVR4821', referred: 2, bonus_paise: 100000 }]);
    return Response.json([]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider><BonusScreen /></ToastProvider>
    </RivrDataProvider>,
  );
  return { historyAsked };
}

export const LATER = { timeout: 5000 };

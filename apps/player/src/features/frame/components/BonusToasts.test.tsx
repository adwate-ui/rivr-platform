import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { ToastProvider } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BonusToasts } from './BonusToasts.tsx';

const MEMBER_USER = '00000000-0000-4000-8000-000000000231';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** A line as my_bonus_history gives it: chips given with a reason, used at a table, or expired; now, unless `at` says when. */
const line = (id: string, kind: string, amount: number, about: { reason?: string; table?: string; at?: Date } = {}) => ({
  line_id: id, at: (about.at ?? new Date()).toISOString(), kind, amount_paise: amount, reason: about.reason ?? null, table_name: about.table ?? null,
});
const anHourAgo = () => new Date(Date.now() - 60 * 60 * 1000);

/** Meera signed in; her newest bonus line is whatever `newest` holds when the history is read. */
function renderToasts(newest: { lines: unknown[] }) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: MEMBER_USER, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  let reads = 0;
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/my_feature_access')) return Response.json([{ feature_key: 'rewards.bonus', state: 'enabled', tiers: null }]);
    if (!url.includes('/rpc/my_bonus_history')) return Response.json([]);
    reads += 1;
    return Response.json(newest.lines);
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })} queryClient={queryClient}>
      <ToastProvider><BonusToasts /></ToastProvider>
    </RivrDataProvider>,
  );
  // What the live channel does when a grant or a redemption lands: the history is read again.
  const landed = async (lines: unknown[]) => {
    newest.lines = lines;
    const before = reads;
    await act(async () => { await queryClient.invalidateQueries({ queryKey: ['user', MEMBER_USER, 'bonus'] }); });
    await waitFor(() => expect(reads).toBeGreaterThan(before));
  };
  // The first read, once the session is in.
  const read = () => waitFor(() => expect(queryClient.getQueryData(['user', MEMBER_USER, 'bonus', 'mine', 'history', 1])).toBeDefined());
  return { landed, read };
}

describe('the bonus toast (decision 0504)', () => {
  it('tells nothing of a line from before the app opened', async () => {
    const { read } = renderToasts({ lines: [line('g1', 'credited', 50_000, { reason: 'Welcome bonus', at: anHourAgo() })] });
    await read();
    expect(screen.queryByText(/bonus chips added/)).toBeNull();
  });

  it('tells a line given since the app opened on its first read: the sign-up bonus, given at the selfie, before Home; once', async () => {
    const { read } = renderToasts({ lines: [line('s1', 'credited', 50_000, { reason: 'Welcome bonus' })] });
    await read();
    expect(await screen.findByText('500 bonus chips added · Welcome bonus')).toBeDefined();
    // A screen outside the frame and back, which mounts it again: told once.
    cleanup();
    const again = renderToasts({ lines: [line('s1', 'credited', 50_000, { reason: 'Welcome bonus' })] });
    await again.read();
    expect(screen.queryByText('500 bonus chips added · Welcome bonus')).toBeNull();
  });

  it('tells chips added and chips used while the app is open, and nothing for chips that expired', async () => {
    const { landed, read } = renderToasts({ lines: [] });
    await read();
    await landed([line('g2', 'credited', 50_000, { reason: 'Welcome bonus' })]);
    expect(await screen.findByText('500 bonus chips added · Welcome bonus')).toBeDefined();
    await landed([line('r1', 'redeemed', 100_000, { table: 'Table 3' })]);
    expect(await screen.findByText('1,000 bonus chips used for your buy-in at Table 3')).toBeDefined();
    await landed([line('x1', 'expired', 20_000, { reason: 'Old bonus' })]);
    expect(screen.queryByText(/Old bonus/)).toBeNull();
  });
});

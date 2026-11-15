import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, type SetupStake, type SetupTable } from '@rivr/db';
import { ToastProvider } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';

/** A stake for a test: 100/200 with three hours of call time unless said. */
export const stake = (id: string, name: string, more: Partial<SetupStake> = {}): SetupStake =>
  ({ id, name, game: null, smallBlind: 10000n, bigBlind: 20000n, straddle: null, callTimeMinutes: 180, ...more });

/** A table for a test: nine seats at stake `s1`, closed, with a minimum buy-in of ₹10,000 unless said. */
export const table = (id: string, name: string, more: Partial<SetupTable> = {}): SetupTable =>
  ({ id, name, stakeId: 's1', seats: 9, minBuyIn: 1000000n, isOpen: false, isActive: true, seated: 0, waiting: 0, ...more });

/**
 * Draws a part of Tables setup for a super admin, inside the console's toasts, over a fake API that keeps every RPC sent
 * and answers those in `refusals` with their code.
 */
export function renderSetup(ui: ReactElement, refusals: Record<string, string> = {}) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const sent: { rpc: string; body: unknown }[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const rpc = url.split('/rpc/')[1]?.split('?')[0];
    if (rpc === undefined) return Response.json([]);
    sent.push({ rpc, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const code = refusals[rpc];
    return code === undefined ? new Response(null, { status: 204 }) : Response.json({ code, message: 'refused' }, { status: 400 });
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider place="console">{ui}</ToastProvider>
    </RivrDataProvider>,
  );
  return sent;
}

/** The row of a list whose first cell is `name`. */
export function rowOf(name: string): HTMLElement {
  const row = screen.getAllByRole('row').find((one) => within(one).queryAllByRole('cell')[0]?.textContent === name);
  if (row === undefined) throw new Error(`No row for ${name}`);
  return row;
}

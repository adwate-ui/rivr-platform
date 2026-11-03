import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { DataTableExportProvider } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrizeWheel } from './PrizeWheel.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const ON_WHEEL = [
  { prize_id: 'p1', kind: 'points', amount: 100, weight: 4, is_drawable: true },
  { prize_id: 'p2', kind: 'points', amount: 500, weight: 2, is_drawable: true },
  // 1,000 bonus chips (in paise) that this month's budget cannot pay: off the wheel.
  { prize_id: 'p3', kind: 'bonus', amount: 100_000, weight: 1, is_drawable: false },
  { prize_id: 'p4', kind: 'nothing', amount: 0, weight: 3, is_drawable: true },
];

/**
 * Aditya, who runs promotions, signed in beneath the console's exports, and a fake API with the wheel's prizes that keeps
 * each removal sent; `canOpenSettings` for staff who open Settings' rules.
 */
function renderPrizes(prizes: readonly object[] = ON_WHEEL, canOpenSettings = true) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const removed: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/remove_spin_prize')) {
      removed.push(JSON.parse(String(init?.body)));
      return new Response(null, { status: 204 });
    }
    if (url.includes('/rpc/spin_prizes')) return Response.json(prizes);
    return Response.json([]);
  });
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })} queryClient={cache}>
      <DataTableExportProvider exporter={async () => true}>
        <PrizeWheel venueId="v1" canKeep canOpenSettings={canOpenSettings} />
      </DataTableExportProvider>
    </RivrDataProvider>,
  );
  return removed;
}

describe('PrizeWheel', () => {
  it('gives each prize that can be won its chance among those that can', async () => {
    renderPrizes();
    const wheel = await screen.findByRole('table', { name: 'The wheel' }, { timeout: 5000 });
    expect(within(wheel).getByRole('row', { name: /100 points.*4 in 9/ })).toBeDefined();
    expect(within(wheel).getByRole('row', { name: /500 points.*2 in 9/ })).toBeDefined();
    expect(within(wheel).getByRole('row', { name: /Nothing.*3 in 9/ })).toBeDefined();
  });

  it('says why a bonus is off the wheel, and links staff who open Settings to the spin budget there', async () => {
    renderPrizes();
    const row = await screen.findByRole('row', { name: /1,000 bonus chips/ }, { timeout: 5000 });
    expect(within(row).getByText('Off the wheel: this month’s spin budget cannot pay it')).toBeDefined();
    expect(within(row).getByRole('link', { name: 'Spin budget' }).getAttribute('href')).toBe('/settings?tab=settings&part=members');
    expect(within(row).queryByText(/ in 9$/)).toBeNull();
  });

  it('gives staff who cannot open Settings the reason alone, the prize Off', async () => {
    renderPrizes(ON_WHEEL, false);
    const row = await screen.findByRole('row', { name: /1,000 bonus chips/ }, { timeout: 5000 });
    expect(within(row).getByText('Off the wheel: this month’s spin budget cannot pay it')).toBeDefined();
    expect(within(row).getByText('Off')).toBeDefined();
    expect(within(row).queryByRole('link')).toBeNull();
  });

  it('offers no export of the prizes, though the console exports its tables', async () => {
    renderPrizes();
    await screen.findByRole('table', { name: 'The wheel' }, { timeout: 5000 });
    expect(screen.queryByRole('button', { name: /^Export / })).toBeNull();
  });

  it('removes a prize only on the second press', async () => {
    const removed = renderPrizes([{ prize_id: 'p1', kind: 'points', amount: 500, weight: 1, is_drawable: true }]);
    fireEvent.click(await screen.findByRole('button', { name: /^Remove / }, { timeout: 5000 }));
    expect(removed).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: /^Yes, remove / }));
    await waitFor(() => expect(removed).toEqual([{ p_venue_id: 'v1', p_prize_id: 'p1' }]));
  });

  it('says the wheel is empty in one line', async () => {
    renderPrizes([]);
    expect(await screen.findByText('No prizes on the wheel yet.', {}, { timeout: 5000 })).toBeDefined();
  });
});

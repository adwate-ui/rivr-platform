import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CatalogueList } from './CatalogueList.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const REWARD = { kind: 'merchandise', detail: 'At the host desk', points: 500, nights: null, is_live: true, photo_path: null };
const ITEMS = [
  { ...REWARD, id: 'cap', name: 'RIVR cap', stock: 0 },
  { ...REWARD, id: 'mug', name: 'RIVR mug', stock: 3 },
  { ...REWARD, id: 'hoodie', name: 'RIVR hoodie', stock: 42 },
  { ...REWARD, id: 'old', name: 'Old tee', stock: 0, is_live: false },
];

function renderList(counts: unknown = [{ reward_item_id: 'mug', redeemed: 12 }]) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000107', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rest/v1/reward_item')) return Response.json(ITEMS);
    if (url.includes('/rpc/reward_redemption_counts')) return Response.json(counts);
    return Response.json([]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <CatalogueList venueId="v1" canEdit={false} onEdit={() => undefined} />
    </RivrDataProvider>,
  );
}

const LATER = { timeout: 5000 };
const rowOf = (name: string) => {
  const row = screen.getByText(name).closest<HTMLElement>('.flex-wrap, [class*="justify-between"]');
  if (row === null) throw new Error(`no row for ${name}`);
  return within(row);
};

describe('the rewards catalogue (F-072)', () => {
  it('says Sold out at none left, Low under five, Live otherwise, and Retired once retired', async () => {
    renderList();
    expect(await screen.findByText('RIVR cap', {}, LATER)).toBeDefined();
    expect(rowOf('RIVR cap').getByText('Sold out')).toBeDefined();
    expect(rowOf('RIVR mug').getByText('Low')).toBeDefined();
    expect(rowOf('RIVR hoodie').getByText('Live')).toBeDefined();
    expect(rowOf('Old tee').getByText('Retired')).toBeDefined();
  });

  it('draws Sold out in gold, the status that waits on staff', async () => {
    renderList();
    expect(await screen.findByText('Sold out', {}, LATER)).toBeDefined();
    expect(screen.getByText('Sold out').parentElement?.querySelector('[data-dot]')?.className).toContain('bg-gold');
  });

  it('lists sold-out rewards after the other live ones, and retired last', async () => {
    renderList();
    expect(await screen.findByText('RIVR cap', {}, LATER)).toBeDefined();
    const names = ['RIVR mug', 'RIVR hoodie', 'RIVR cap', 'Old tee'].map((name) => screen.getByText(name));
    const follows = (first: HTMLElement, then: HTMLElement) => Boolean(first.compareDocumentPosition(then) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(names.every((name, index) => index === 0 || follows(names[index - 1] ?? name, name))).toBe(true);
  });

  it('shows how many of each went in the last 30 days, none as 0', async () => {
    renderList();
    expect(await screen.findByText('Redeemed (30 days): 12', {}, LATER)).toBeDefined();
    expect(rowOf('RIVR cap').getByText('Redeemed (30 days): 0')).toBeDefined();
  });

  it('leaves the figure out when it cannot be read', async () => {
    renderList({ code: 'XX000', message: 'down' });
    expect(await screen.findByText('RIVR cap', {}, LATER)).toBeDefined();
    expect(screen.queryByText(/Redeemed/)).toBeNull();
  });
});

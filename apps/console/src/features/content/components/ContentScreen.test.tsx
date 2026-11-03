import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Content } from './ContentScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** Some of the club's pages as the editor reads them: the home and link-in-bio pages both titled with the club's name. */
const PAGES = [
  { id: 'p-about', slug: 'about', title: 'About' }, { id: 'p-home', slug: 'home', title: 'RIVR Poker Club' },
  { id: 'p-links', slug: 'links', title: 'RIVR Poker Club' }, { id: 'p-rules', slug: 'house-rules', title: 'House rules' },
  { id: 'p-bank', slug: 'journal-bankroll', title: 'Bankroll basics' }, { id: 'p-terms', slug: 'terms', title: 'Terms of use' },
];

function renderTab(tab: string | undefined, onNavigate = vi.fn()) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    return Response.json(url.includes('/rest/v1/site_page') ? PAGES : []);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Content venueId="v1" tabs={['website', 'learn']} tab={tab} onNavigate={onNavigate} />
    </RivrDataProvider>,
  );
  return onNavigate;
}

describe('Content', () => {
  it('lists the website’s pages in Club, Guides and Legal, the home and link-in-bio pages named apart', async () => {
    renderTab(undefined);
    const list = await screen.findByRole('region', { name: 'Pages' }, { timeout: 5000 });
    for (const group of ['Club', 'Guides', 'Legal']) expect(within(list).getByRole('heading', { name: group })).toBeDefined();
    expect(within(list).getByRole('button', { name: 'Home' })).toBeDefined();
    expect(within(list).getByRole('button', { name: 'Link in bio' })).toBeDefined();
    expect(within(list).queryByRole('button', { name: 'RIVR Poker Club' })).toBeNull();
    // The first page opens beside the list until another is chosen.
    expect(screen.getByRole('heading', { name: 'About', level: 2 })).toBeDefined();
    fireEvent.click(within(list).getByRole('button', { name: 'House rules' }));
    expect(screen.getByRole('heading', { name: 'House rules', level: 2 })).toBeDefined();
  });

  it('finds a page by its name', async () => {
    renderTab('website');
    fireEvent.change(await screen.findByRole('searchbox', { name: 'Find a page' }, { timeout: 5000 }), { target: { value: 'bank' } });
    const list = screen.getByRole('region', { name: 'Pages' });
    expect(within(list).getAllByRole('button').map((button) => button.textContent)).toEqual(['Bankroll basics']);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a page' }), { target: { value: 'no such page' } });
    expect(within(list).getByText('No page matches.')).toBeDefined();
  });

  it('keeps the Learn content on its own tab, through the address', async () => {
    const onNavigate = renderTab('learn');
    expect(await screen.findByRole('heading', { name: 'Add a source' }, { timeout: 5000 })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Learn content' }).getAttribute('aria-current')).toBe('page');
    fireEvent.click(screen.getByRole('link', { name: 'Website' }));
    expect(onNavigate).toHaveBeenCalledWith('/content?tab=website');
  });
});

import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Social } from './SocialScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const POST = { media_url: 'https://example.test/p.jpg', posted_at: '2026-11-03T05:00:00Z' };
/** Two posts that tag the club waiting, and one already on the wall. */
const WALL = [
  { ...POST, id: 'w1', handle: 'kabir.s', caption: 'Sunday at the club', permalink: 'https://instagram.test/1', status: 'pending' },
  { ...POST, id: 'w2', handle: 'zoya.plays', caption: 'Final table tonight', permalink: 'https://instagram.test/2', status: 'pending' },
  { ...POST, id: 'w3', handle: 'ira', caption: 'Chai and cards', permalink: 'https://instagram.test/3', status: 'approved' },
];

function renderTab(tab: string | undefined, onNavigate = vi.fn()) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const moderated: string[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/moderate_wall_post')) {
      moderated.push(String(init?.body ?? ''));
      return new Response(null, { status: 204 });
    }
    return Response.json(url.includes('/rest/v1/wall_post') ? WALL.filter((post) => (post.status === 'pending') === url.includes('status=eq.pending')) : []);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Social venueId="v1" tab={tab} onNavigate={onNavigate} />
    </RivrDataProvider>,
  );
  return { moderated, onNavigate };
}

describe('Social', () => {
  it('opens on the social wall, counting the posts waiting, each to approve or reject', async () => {
    const { moderated } = renderTab(undefined);
    expect(await screen.findByRole('link', { name: 'Social wall 2' }, { timeout: 5000 })).toBeDefined();
    const zoya = (await screen.findByText('@zoya.plays')).closest('article');
    if (zoya === null) throw new Error('no card for the post');
    expect(within(zoya).getByText('Waiting')).toBeDefined();
    fireEvent.click(within(zoya).getByRole('button', { name: 'Approve @zoya.plays’s post' }));
    expect(within(zoya).getByRole('button', { name: 'Reject @zoya.plays’s post' })).toBeDefined();
    await vi.waitFor(() => expect(moderated[0]).toContain('"p_is_approved":true'));
    const ira = screen.getByText('@ira').closest('article');
    if (ira === null) throw new Error('no card for the post');
    expect(within(ira).getByText('On the wall')).toBeDefined();
    expect(within(ira).queryByRole('button', { name: /^Approve/ })).toBeNull();
  });

  it('puts publishing and the leads on their own tabs, through the address', async () => {
    const { onNavigate } = renderTab('publish');
    expect(await screen.findByRole('textbox', { name: 'Caption' }, { timeout: 5000 })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Publish' }).getAttribute('aria-current')).toBe('page');
    fireEvent.click(screen.getByRole('link', { name: /^Leads/ }));
    expect(onNavigate).toHaveBeenCalledWith('/social?tab=leads');
  });

  it('lists the leads on Leads, and says so when there are none', async () => {
    renderTab('leads');
    expect(await screen.findByText('No messages yet.', undefined, { timeout: 5000 })).toBeDefined();
    expect(screen.queryByText('@zoya.plays')).toBeNull();
  });
});

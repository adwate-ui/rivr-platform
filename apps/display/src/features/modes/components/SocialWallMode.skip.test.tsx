import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SocialWallMode } from './SocialWallMode.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const LATER = { timeout: 5000 };

/** The wall on a signed-in TV, answering with `posts`. */
function renderWall(posts: readonly object[], onEmpty: () => void) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-0000000000e1', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    return Response.json(url.includes('/rpc/tv_social_wall') ? posts : []);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SocialWallMode onEmpty={onEmpty} />
    </RivrDataProvider>,
  );
}

describe('the social wall in a rotation (F-142)', () => {
  it('with no posts, passes its half minute on', async () => {
    const onEmpty = vi.fn();
    renderWall([], onEmpty);
    await waitFor(() => expect(onEmpty).toHaveBeenCalled(), LATER);
  });

  it('with a post, keeps it', async () => {
    const onEmpty = vi.fn();
    renderWall([{ handle: 'zoya.plays', caption: 'Final table at RIVR' }], onEmpty);
    expect(await screen.findByText('@zoya.plays', {}, LATER)).toBeDefined();
    expect(onEmpty).not.toHaveBeenCalled();
  });
});

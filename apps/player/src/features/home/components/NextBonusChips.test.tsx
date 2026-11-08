import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextBonusChips } from './NextBonusChips.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const STEP = { chips: 500, after_minutes: 120, seconds_left: 4800 };
const FEED = [{ feature_key: 'promotions.feed', state: 'enabled', tiers: null }];

/** A signed-in member with these features and this next step; resolves once both reads have been answered. */
async function renderLine(features: readonly unknown[], next: readonly unknown[]) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000231', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const asked = new Set<string>();
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    const name = url.replace(/^.*\/rpc\//, '').replace(/\?.*$/, '');
    asked.add(name);
    return Response.json(name === 'my_feature_access' ? features : next);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })} queryClient={new QueryClient()}>
      <NextBonusChips />
    </RivrDataProvider>,
  );
  await waitFor(() => expect([...asked].sort()).toEqual(['my_feature_access', 'my_next_play_time_bonus']), { timeout: 5000 });
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 0); }); });
}

describe('Tonight › The next play-time bonus (audit F-173)', () => {
  it('says the next step and how long to it', async () => {
    await renderLine(FEED, [STEP]);
    expect(await screen.findByText('Next: 500 bonus chips')).toBeDefined();
    expect(screen.getByText('in 1 h 20 min')).toBeDefined();
  });

  it('says one minute in the last minute, never no time at all', async () => {
    await renderLine(FEED, [{ ...STEP, seconds_left: 20 }]);
    expect(await screen.findByText('in 1 min')).toBeDefined();
  });

  it('says nothing without promotions.feed', async () => {
    await renderLine([], [STEP]);
    expect(screen.queryByText('Next: 500 bonus chips')).toBeNull();
  });

  it('says nothing when no bonus is counting', async () => {
    await renderLine(FEED, []);
    expect(screen.queryByText(/^Next: /)).toBeNull();
  });
});

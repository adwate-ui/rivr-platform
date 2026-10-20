import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, type Preferences } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GamesSection } from './GamesSection.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const KABIR = '00000000-0000-4000-8000-000000000202';
const STAKES = [{ small_blind_paise: 5000, big_blind_paise: 10000 }, { small_blind_paise: 10000, big_blind_paise: 20000 }];

/** Kabir signed in, with his club's stakes as my_stakes gives them; every save is kept, and each stakes request counted. */
function renderGames(preferences: Preferences, stakes: unknown[] = STAKES) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: KABIR, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const api: { saved: unknown[]; stakesAsked: number } = { saved: [], stakesAsked: 0 };
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/save_my_preferences')) {
      api.saved.push(JSON.parse(String(init?.body)));
      return new Response(null, { status: 204 });
    }
    if (url.includes('/rpc/my_stakes')) api.stakesAsked += 1;
    return Response.json(url.includes('/rpc/my_stakes') ? stakes : []);
  });
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })} queryClient={cache}>
      <GamesSection preferences={preferences} />
    </RivrDataProvider>,
  );
  return api;
}

// The first answer waits on the session being read, which is slow when every package tests at once.
const FIRST = { timeout: 5000 };
const chips = (group: HTMLElement) => [...group.querySelectorAll('button')].map((button) => button.textContent);
const NONE: Preferences = { games: ['nlh'], stake: null, notificationsOff: [], marketing: false };

describe('Waitlist alerts: the stake', () => {
  it('offers the club\'s stakes and any, with any chosen at first', async () => {
    renderGames(NONE);
    expect(chips(await screen.findByRole('group', { name: 'Stake' }, FIRST))).toEqual(['Any', '50/100', '100/200']);
    expect(screen.getByRole('button', { name: 'Any' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('saves a stake with the games as they are, and any as no stake', async () => {
    const first = renderGames(NONE);
    fireEvent.click(await screen.findByRole('button', { name: '100/200' }, FIRST));
    await waitFor(() => expect(first.saved).toEqual([{ p_games: ['nlh'], p_small_blind: 10000, p_big_blind: 20000 }]));
    cleanup();
    const again = renderGames({ ...NONE, stake: { smallBlind: 10000n, bigBlind: 20000n } });
    expect((await screen.findByRole('button', { name: '100/200' }, FIRST)).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Any' }));
    await waitFor(() => expect(again.saved).toEqual([{ p_games: ['nlh'] }]));
  });

  it('keeps a saved stake the club no longer runs, chosen, so it can be changed', async () => {
    renderGames({ ...NONE, stake: { smallBlind: 5000n, bigBlind: 20000n } });
    expect(chips(await screen.findByRole('group', { name: 'Stake' }, FIRST))).toEqual(['Any', '50/100', '100/200', '50/200']);
    expect(screen.getByRole('button', { name: '50/200' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('shows no stake when the club runs no tables', async () => {
    const api = renderGames(NONE, []);
    await waitFor(() => expect(api.stakesAsked).toBe(1), FIRST);
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Stake' })).toBeNull());
    expect(screen.getByRole('group', { name: 'Games' })).toBeDefined();
  });
});

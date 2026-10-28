import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';
import { useMyWinnerCards, useShareWinnerCard, useWinnerCardsToPost } from './winnerCards.ts';

const KAVYA = '00000000-0000-4000-8000-000000000639';
const PATH = '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000009c1.png';
const card = { card_id: '00000000-0000-4000-8000-0000000009c1', kind: 'tournament', details: { event_name: 'Weeknight Turbo' }, prize_paise: 12000000, won_at: '2026-11-15T20:10:00+00:00' };

/** A fake API: each function answers with its rows, and Storage signs each path it is given. */
function renderCards(rows: Record<string, unknown>) {
  const calls: string[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push(url);
    if (url.includes('/storage/v1/object/sign/winner-cards')) {
      const body: unknown = JSON.parse(String(init?.body));
      const paths = typeof body === 'object' && body !== null && 'paths' in body && Array.isArray(body.paths) ? body.paths.map(String) : [];
      return Response.json(paths.map((path) => ({ error: null, path, signedURL: `/object/sign/winner-cards/${path}?token=t` })));
    }
    const name = Object.keys(rows).find((each) => url.includes(`/rest/v1/rpc/${each}`));
    return name === undefined ? new Response(null, { status: 204 }) : Response.json(rows[name]);
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(KAVYA), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({ mine: useMyWinnerCards(), share: useShareWinnerCard(), toPost: useWinnerCardsToPost('v1') }), { wrapper });
  return { result, calls };
}

afterEach(cleanup);

describe('winner cards', () => {
  it('gives the member their cards, a drawn one with its link and one still to draw with none', async () => {
    const { result } = renderCards({
      my_winner_cards: [{ ...card, image_path: PATH, is_shared: true }, { ...card, card_id: 'c2', kind: 'jackpot', details: {}, image_path: null, is_shared: false }],
      winner_cards_to_post: [],
    });
    await waitFor(() => expect(result.current.mine.data).toHaveLength(2));
    expect(result.current.mine.data).toEqual([
      { cardId: card.card_id, kind: 'tournament', eventName: 'Weeknight Turbo', prizePaise: 12000000n, wonAt: card.won_at, isShared: true,
        imageUrl: `http://127.0.0.1:9/storage/v1/object/sign/winner-cards/${PATH}?token=t` },
      { cardId: 'c2', kind: 'jackpot', eventName: null, prizePaise: 12000000n, wonAt: card.won_at, isShared: false, imageUrl: null },
    ]);
  });

  it('gives staff the shared cards, each with its player and a link to download', async () => {
    const { result } = renderCards({
      my_winner_cards: [],
      winner_cards_to_post: [{ ...card, image_path: PATH, player_name: 'Kavya R.', shared_at: '2026-11-16T10:00:00+00:00' }],
    });
    await waitFor(() => expect(result.current.toPost.data).toHaveLength(1));
    expect(result.current.toPost.data?.[0]).toMatchObject({ playerName: 'Kavya R.', sharedAt: '2026-11-16T10:00:00+00:00', eventName: 'Weeknight Turbo' });
    expect(result.current.toPost.data?.[0]?.imageUrl).toMatch(/\/object\/sign\/winner-cards\/.+\.png\?token=t&download=$/);
  });

  it('shares a card, and stops sharing it', async () => {
    const { result, calls } = renderCards({ my_winner_cards: [], winner_cards_to_post: [] });
    expect(await act(() => result.current.share.mutateAsync({ cardId: card.card_id, isShared: true }))).toEqual({ ok: true, value: null });
    expect(calls.filter((url) => url.includes('/rpc/share_winner_card'))).toHaveLength(1);
  });
});

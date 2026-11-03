import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';
import { usePublishTournament } from './tournamentInterest.ts';

const SIGNED_IN = '00000000-0000-4000-8000-000000000103';
const VENUE = '00000000-0000-4000-8000-000000000001';

/** A fake API that answers publish_tournament with `reply`, and the bodies it was sent. */
function renderPublish(reply: { status?: number; body: unknown }) {
  const sent: unknown[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!url.includes('/rpc/publish_tournament')) return Response.json([]);
    sent.push(init?.body ? JSON.parse(String(init.body)) : undefined);
    return Response.json(reply.body, { status: reply.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(SIGNED_IN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => usePublishTournament(VENUE), { wrapper });
  return { result, sent };
}

const LISTING = {
  name: ' Diwali Deepstack ', startsAt: new Date('2026-11-15T10:30:00Z'), game: 'No-limit hold’em', stake: '25,000 chips', description: '',
};

afterEach(cleanup);

describe('a tournament published without money', () => {
  it('publishes its name, start, game, stake and description, and no money', async () => {
    const { result, sent } = renderPublish({ body: 't1' });
    let published: unknown;
    await act(async () => { published = await result.current.mutateAsync(LISTING); });
    expect(published).toEqual({ ok: true, value: 't1' });
    expect(sent).toEqual([{
      p_venue_id: VENUE, p_name: 'Diwali Deepstack', p_starts_at: '2026-11-15T10:30:00.000Z', p_game: 'No-limit hold’em',
      p_stake: '25,000 chips', p_description: '',
    }]);
  });

  it('says why it was not published', async () => {
    for (const [code, failure] of [['22023', 'invalid'], ['42501', 'not_allowed'], ['RVFRZ', 'paused'], ['XX000', 'unavailable']]) {
      const { result } = renderPublish({ status: 400, body: { code, message: 'no' } });
      let published: unknown;
      await act(async () => { published = await result.current.mutateAsync(LISTING); });
      expect(published).toEqual({ ok: false, error: failure });
    }
  });
});

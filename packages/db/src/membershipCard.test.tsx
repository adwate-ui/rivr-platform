import { createClient } from '@supabase/supabase-js';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useMembershipCard } from './membershipCard.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const MEMBER = '00000000-0000-4000-8000-000000000290';

/** A fake API that answers my_membership_card with each reply in turn, the last one again after. */
function renderCard(replies: unknown[]) {
  let asked = 0;
  const fetch: typeof globalThis.fetch = async () => {
    const reply = replies[Math.min(asked, replies.length - 1)];
    asked += 1;
    return Response.json(reply);
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(MEMBER), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  return renderHook(() => useMembershipCard(), { wrapper });
}

const row = (code: string, msLeft: number) => ({ member_number: 1024, full_name: 'Kavya Rao', tier_name: 'Member', code, ms_left: msLeft });

afterEach(cleanup);

describe('the membership card', () => {
  it('gives the member\'s card with its code for now', async () => {
    const { result } = renderCard([[row('card.1.mac', 60_000)]]);
    await waitFor(() => expect(result.current.data).toEqual({ memberNumber: '1024', fullName: 'Kavya Rao', tierName: 'Member', code: 'card.1.mac', msLeft: 60_000 }));
  });

  it('asks for the next code as soon as this one changes', async () => {
    const { result } = renderCard([[row('card.1.mac', 1_000)], [row('card.2.mac', 60_000)]]);
    await waitFor(() => expect(result.current.data?.code).toBe('card.1.mac'));
    await waitFor(() => expect(result.current.data?.code).toBe('card.2.mac'), { timeout: 4_000 });
  });

  it('is nothing for someone who is not a member, such as staff', async () => {
    const { result } = renderCard([[]]);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});

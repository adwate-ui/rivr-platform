import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useMyNotices, useNoticeActions, useVenueNotices } from './notices.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const VENUE = '00000000-0000-4000-8000-000000000001';

/** A fake API: each path answers with its reply; every call is kept with what it sent. */
function renderHooks(replies: Record<string, { status?: number; body: unknown }>) {
  const calls: { url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const path = Object.keys(replies).find((key) => url.includes(key));
    const reply = path ? replies[path] : undefined;
    return Response.json(reply?.body ?? [], { status: reply?.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor('00000000-0000-4000-8000-000000000102'), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({ mine: useMyNotices(), venue: useVenueNotices(VENUE), actions: useNoticeActions(VENUE) }), { wrapper });
  return { result, calls };
}

const bodiesOf = (calls: { url: string; body: unknown }[], path: string) => calls.filter((call) => call.url.includes(path)).map((call) => call.body);

afterEach(cleanup);

describe('notices', () => {
  it('reads the member\'s and the venue\'s notices, puts one up and ends one', async () => {
    const { result, calls } = renderHooks({
      '/rpc/my_notices': { body: [{ notice_id: 'n1', body: 'We\'re launching soon.' }] },
      '/rpc/venue_notices': { body: [{ notice_id: 'n1', body: 'We\'re launching soon.', starts_at: '2026-11-02T10:00:00+00:00', ends_at: null }] },
      '/rpc/post_notice': { body: 'n2' },
      '/rpc/end_notice': { body: null },
    });
    await waitFor(() => expect(result.current.mine.data).toEqual([{ noticeId: 'n1', body: 'We\'re launching soon.' }]));
    await waitFor(() => expect(result.current.venue.data?.[0]).toEqual({
      noticeId: 'n1', body: 'We\'re launching soon.', startsAt: '2026-11-02T10:00:00+00:00', endsAt: null,
    }));
    let posted: unknown;
    let ended: unknown;
    await act(async () => {
      posted = await result.current.actions.post.mutateAsync('Open till 4 tonight.');
      ended = await result.current.actions.end.mutateAsync('n1');
    });
    expect(posted).toEqual({ ok: true, value: 'n2' });
    expect(ended).toEqual({ ok: true, value: null });
    expect(bodiesOf(calls, '/rpc/post_notice')).toEqual([{ p_venue_id: VENUE, p_body: 'Open till 4 tonight.' }]);
    expect(bodiesOf(calls, '/rpc/end_notice')).toEqual([{ p_notice_id: 'n1' }]);
  });

  it('says why a notice was refused', async () => {
    const { result } = renderHooks({
      '/rpc/post_notice': { status: 400, body: { code: '22023', message: 'too long' } },
      '/rpc/end_notice': { status: 403, body: { code: '42501', message: 'not staff' } },
    });
    let posted: unknown;
    let ended: unknown;
    await act(async () => {
      posted = await result.current.actions.post.mutateAsync('x'.repeat(281));
      ended = await result.current.actions.end.mutateAsync('n1');
    });
    expect(posted).toEqual({ ok: false, error: 'invalid' });
    expect(ended).toEqual({ ok: false, error: 'not_allowed' });
  });

  it('edits a notice in place: its words, its start and its end (decision 0424)', async () => {
    const { result, calls } = renderHooks({ '/rpc/update_notice': { body: null } });
    let edited: unknown;
    await act(async () => {
      edited = await result.current.actions.update.mutateAsync({
        noticeId: 'n1', body: 'Launch night is Sunday.\nDoors at 8 pm.', startsAt: '2026-11-04T13:30:00.000Z', endsAt: null,
      });
    });
    expect(edited).toEqual({ ok: true, value: null });
    // No end sent: the function's default, null, runs it until ended.
    expect(bodiesOf(calls, '/rpc/update_notice')).toEqual([{
      p_notice_id: 'n1', p_body: 'Launch night is Sunday.\nDoors at 8 pm.', p_starts_at: '2026-11-04T13:30:00.000Z',
    }]);
  });

  it('says when the notice being edited has ended meanwhile', async () => {
    const { result } = renderHooks({ '/rpc/update_notice': { status: 404, body: { code: 'P0002', message: 'ended' } } });
    let edited: unknown;
    await act(async () => {
      edited = await result.current.actions.update.mutateAsync({ noticeId: 'n1', body: 'Too late', startsAt: null, endsAt: null });
    });
    expect(edited).toEqual({ ok: false, error: 'ended' });
  });
});

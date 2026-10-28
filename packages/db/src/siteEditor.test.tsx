import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { useEditorPage, useSiteEditor, useSitePages } from './siteEditor.ts';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const VENUE = '00000000-0000-4000-8000-000000000001';
const PAGE = 'p1';

/** A fake API: each path answers with its reply; every call is kept with what it sent. */
function renderHooks(replies: Record<string, { status?: number; body: unknown }>) {
  const calls: { url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined });
    const path = Object.keys(replies).find((key) => url.includes(key));
    const reply = path ? replies[path] : undefined;
    return Response.json(reply?.body ?? [], { status: reply?.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor('00000000-0000-4000-8000-000000000107'), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({ pages: useSitePages(VENUE), page: useEditorPage(PAGE), editor: useSiteEditor(VENUE, PAGE) }), { wrapper });
  return { result, calls };
}

const bodyOf = (calls: { url: string; body: unknown }[], path: string) => calls.filter((call) => call.url.includes(path)).map((call) => call.body);

afterEach(cleanup);

describe('the website editor', () => {
  it('reads the pages, and a page\u2019s blocks and versions, newest first', async () => {
    const { result } = renderHooks({
      '/rest/v1/site_page': { body: [{ id: PAGE, slug: 'house-rules', title: 'House rules' }] },
      '/rest/v1/site_block': { body: [{ kind: 'text', content: { heading: 'House rules', body: 'One player to a hand.' } }] },
      '/rest/v1/site_revision': { body: [
        { id: 'r2', status: 'scheduled', blocks: [{ kind: 'text', content: { heading: 'Tonight' } }, 'junk'], publish_at: '2026-11-15T12:30:00+00:00',
          published_at: null, created_at: '2026-11-15T10:00:00+00:00', preview_token: 't2' },
        { id: 'r1', status: 'unknown', blocks: {}, publish_at: null, published_at: '2026-11-14T10:00:00+00:00', created_at: '2026-11-14T10:00:00+00:00', preview_token: 't1' },
      ] },
    });
    await waitFor(() => expect(result.current.pages.data).toEqual([{ pageId: PAGE, slug: 'house-rules', title: 'House rules' }]));
    await waitFor(() => expect(result.current.page.data?.blocks).toEqual([{ kind: 'text', content: { heading: 'House rules', body: 'One player to a hand.' } }]));
    expect(result.current.page.data?.revisions).toEqual([
      { revisionId: 'r2', status: 'scheduled', blocks: [{ kind: 'text', content: { heading: 'Tonight' } }], publishAt: '2026-11-15T12:30:00+00:00',
        publishedAt: null, createdAt: '2026-11-15T10:00:00+00:00', previewToken: 't2' },
      { revisionId: 'r1', status: 'replaced', blocks: [], publishAt: null, publishedAt: '2026-11-14T10:00:00+00:00', createdAt: '2026-11-14T10:00:00+00:00',
        previewToken: 't1' },
    ]);
  });

  it('saves a draft, publishes it now or at a time, and publishes an earlier version, saying why one is refused', async () => {
    const { result, calls } = renderHooks({
      '/rpc/save_site_draft': { body: 'token-1' },
      '/rpc/publish_site_draft': { body: '2026-11-15T12:30:00+00:00' },
      '/rpc/rollback_site_page': { status: 400, body: { code: 'RVFRZ', message: 'frozen' } },
    });
    let saved: unknown;
    let rolledBack: unknown;
    await act(async () => {
      saved = await result.current.editor.save.mutateAsync([{ kind: 'text', content: { heading: 'House rules' } }]);
      await result.current.editor.publish.mutateAsync(null);
      await result.current.editor.publish.mutateAsync(new Date('2026-11-15T12:30:00Z'));
      rolledBack = await result.current.editor.rollback.mutateAsync('r1');
    });
    expect(saved).toEqual({ ok: true, value: 'token-1' });
    expect(rolledBack).toEqual({ ok: false, error: 'paused' });
    expect(bodyOf(calls, '/rpc/save_site_draft')).toEqual([{ p_venue_id: VENUE, p_page_id: PAGE, p_blocks: [{ kind: 'text', content: { heading: 'House rules' } }] }]);
    expect(bodyOf(calls, '/rpc/publish_site_draft')).toEqual([
      { p_venue_id: VENUE, p_page_id: PAGE }, { p_venue_id: VENUE, p_page_id: PAGE, p_publish_at: '2026-11-15T12:30:00.000Z' },
    ]);
  });
});

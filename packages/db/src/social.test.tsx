import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { useLeads, useModerateWallPost, usePublishSocialPost, useSocialPosts, useTvSocialWall, useWallPosts } from './social.ts';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const VENUE = '00000000-0000-4000-8000-000000000001';

/** A fake API: each path answers with its reply; every call is kept with what it sent. */
function renderHooks(replies: Record<string, { status?: number; body: unknown }>) {
  const calls: { url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    calls.push({ url, body });
    const path = Object.keys(replies).find((key) => url.includes(key));
    const reply = path ? replies[path] : undefined;
    return Response.json(reply?.body ?? [], { status: reply?.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor('00000000-0000-4000-8000-000000000107'), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({
    wall: useWallPosts(VENUE), moderate: useModerateWallPost(VENUE), leads: useLeads(VENUE), posts: useSocialPosts(VENUE),
    publish: usePublishSocialPost(VENUE), tv: useTvSocialWall(),
  }), { wrapper });
  return { result, calls };
}

const bodyOf = (calls: { url: string; body: unknown }[], path: string) => calls.find((call) => call.url.includes(path))?.body;

afterEach(cleanup);

describe('social', () => {
  it('reads the wall\u2019s posts, the leads, the posts published and the TV\u2019s wall', async () => {
    const { result } = renderHooks({
      '/rest/v1/wall_post': { body: [{ id: 'w1', handle: 'zoya.plays', caption: 'Final table', media_url: 'https://cdn.example/1.jpg',
        permalink: 'https://www.instagram.com/p/1/', posted_at: '2026-11-15T18:00:00+00:00', status: 'approved' }] },
      '/rpc/venue_leads': { body: [
        { lead_id: 'l1', channel: 'whatsapp', handle: '+919876543210', first_message: 'Hi', last_message_at: '2026-11-15T18:10:00+00:00', messages: 2, member_name: 'Yash Gupta' },
        { lead_id: 'l2', channel: 'tiktok', handle: 'x', first_message: 'Hi', last_message_at: '2026-11-15T18:00:00+00:00', messages: 1, member_name: null },
      ] },
      '/rest/v1/social_post': { body: [{ id: 'p1', caption: 'RIVR Sunday', image_path: `${VENUE}/a.png`, created_at: '2026-11-15T10:00:00+00:00',
        social_post_channel: [{ channel: 'instagram', post_url: null }, { channel: 'myspace', post_url: null }] }] },
      '/rpc/tv_social_wall': { body: [{ handle: 'zoya.plays', caption: 'Final table', posted_at: '2026-11-15T18:00:00+00:00' }] },
    });
    await waitFor(() => expect(result.current.wall.data).toEqual([{ postId: 'w1', handle: 'zoya.plays', caption: 'Final table', mediaUrl: 'https://cdn.example/1.jpg',
      permalink: 'https://www.instagram.com/p/1/', postedAt: '2026-11-15T18:00:00+00:00', status: 'approved' }]));
    await waitFor(() => expect(result.current.leads.data).toEqual([{ leadId: 'l1', channel: 'whatsapp', handle: '+919876543210', firstMessage: 'Hi',
      lastMessageAt: '2026-11-15T18:10:00+00:00', messages: 2, memberName: 'Yash Gupta' }]));
    await waitFor(() => expect(result.current.posts.data?.[0]?.channels).toEqual([{ channel: 'instagram', postUrl: null }]));
    expect(result.current.posts.data?.[0]?.imageUrl).toMatch(/\/social-media\/.*a\.png\?download=/);
    await waitFor(() => expect(result.current.tv.data).toEqual([{ handle: 'zoya.plays', caption: 'Final table' }]));
  });

  it('moderates a post, publishes one with its image, and says why one is refused', async () => {
    const { result, calls } = renderHooks({
      '/rpc/moderate_wall_post': { status: 404, body: { code: 'P0002', message: 'gone' } },
      '/rpc/publish_social_post': { status: 400, body: { code: 'RVKIL', message: 'off' } },
    });
    let moderated: unknown;
    let published: unknown;
    let unsupported: unknown;
    await act(async () => {
      moderated = await result.current.moderate.mutateAsync({ postId: 'w1', isApproved: true });
      published = await result.current.publish.mutateAsync({ caption: 'Sunday', image: new File(['x'], 'a.png', { type: 'image/png' }), channels: ['instagram'] });
      unsupported = await result.current.publish.mutateAsync({ caption: 'Sunday', image: new File(['x'], 'a.gif', { type: 'image/gif' }), channels: ['instagram'] });
    });
    expect(moderated).toEqual({ ok: false, error: 'gone' });
    expect(published).toEqual({ ok: false, error: 'paused' });
    expect(unsupported).toEqual({ ok: false, error: 'invalid' });
    expect(bodyOf(calls, '/rpc/moderate_wall_post')).toEqual({ p_venue_id: VENUE, p_post_id: 'w1', p_is_approved: true });
    expect(bodyOf(calls, '/rpc/publish_social_post')).toMatchObject({ p_venue_id: VENUE, p_caption: 'Sunday', p_channels: ['instagram'] });
  });
});

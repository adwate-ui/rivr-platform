import { describe, expect, it } from 'vitest';
import { createFakeInstagramGraph } from './fake.ts';
import { createInstagramGraph } from './live.ts';
import { pullWallPosts } from './pull.ts';
import type { TaggedPost } from './types.ts';

const POST: TaggedPost = {
  id: '1789', username: 'zoya.plays', caption: 'Final table at RIVR', mediaUrl: 'https://cdn.example/1789.jpg', mediaKind: 'image',
  permalink: 'https://www.instagram.com/p/abc/', postedAt: new Date('2026-11-15T18:00:00Z'),
};

describe('pullWallPosts', () => {
  it('records the posts since the newest held, and nothing when there are none', async () => {
    const instagram = createFakeInstagramGraph();
    instagram.addTaggedPost(POST);
    instagram.addTaggedPost({ ...POST, id: 'old', postedAt: new Date('2026-11-01T00:00:00Z') });
    const recorded: TaggedPost[][] = [];
    const pull = { instagram, since: async () => new Date('2026-11-10T00:00:00Z'), record: async (posts: readonly TaggedPost[]) => { recorded.push([...posts]); return posts.length; } };
    expect(await pullWallPosts(pull)).toEqual({ recorded: 1 });
    expect(recorded).toEqual([[POST]]);
    expect(await pullWallPosts({ ...pull, since: async () => new Date('2026-12-01T00:00:00Z') })).toEqual({ recorded: 0 });
    expect(recorded).toHaveLength(1);
  });

  it('says why Instagram could not be read', async () => {
    const instagram = createFakeInstagramGraph();
    instagram.failNext({ code: 'rate_limited' });
    expect(await pullWallPosts({ instagram, since: async () => new Date(0), record: async () => 0 })).toEqual({ failure: { code: 'rate_limited' } });
  });
});

describe('createInstagramGraph', () => {
  it('asks for the tagged posts with the token in a header, and reads them, a video as a video', async () => {
    const asked: { url: string; auth: string | null }[] = [];
    const fetch: typeof globalThis.fetch = async (input, init) => {
      asked.push({ url: String(input), auth: new Headers(init?.headers).get('authorization') });
      return Response.json({ data: [
        { id: '1', username: 'a', caption: 'Hi', media_url: 'https://cdn.example/1.mp4', media_type: 'VIDEO', permalink: 'https://www.instagram.com/p/1/', timestamp: '2026-11-15T18:00:00+0000' },
        { id: '2', username: 'b', media_url: 'https://cdn.example/2.jpg', media_type: 'CAROUSEL_ALBUM', permalink: 'https://www.instagram.com/p/2/', timestamp: '2026-11-01T18:00:00+0000' },
        { id: '3', username: 'c' },
      ] });
    };
    const instagram = createInstagramGraph({ instagramUserId: '178', accessToken: 'token', fetch });
    const posts = await instagram.listTaggedPosts({ since: new Date('2026-11-10T00:00:00Z'), limit: 50 });
    expect(posts).toEqual({ ok: true, value: [{ id: '1', username: 'a', caption: 'Hi', mediaUrl: 'https://cdn.example/1.mp4', mediaKind: 'video',
      permalink: 'https://www.instagram.com/p/1/', postedAt: new Date('2026-11-15T18:00:00Z') }] });
    expect(asked[0]?.url).toBe('https://graph.facebook.com/v23.0/178/tags?fields=id,username,caption,media_url,media_type,permalink,timestamp&limit=50');
    expect(asked[0]?.auth).toBe('Bearer token');
  });

  it('is rate limited on 429, unavailable on a server error or no reply, and rejected otherwise', async () => {
    const answering = (status: number): typeof globalThis.fetch => async () => new Response('{}', { status });
    const list = (fetch: typeof globalThis.fetch) => createInstagramGraph({ instagramUserId: '178', accessToken: 'token', fetch }).listTaggedPosts({ since: new Date(0), limit: 5 });
    expect(await list(answering(429))).toEqual({ ok: false, error: { code: 'rate_limited' } });
    expect(await list(answering(503))).toEqual({ ok: false, error: { code: 'unavailable' } });
    expect(await list(answering(400))).toEqual({ ok: false, error: { code: 'rejected', reason: 'Instagram error 400' } });
    expect(await list(async () => { throw new Error('offline'); })).toEqual({ ok: false, error: { code: 'unavailable' } });
  });
});

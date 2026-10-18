import { describe, expect, it } from 'vitest';
import { createFakeInstagramGraph, type TaggedPost } from './index.ts';

function tagged(id: string, postedAt: string): TaggedPost {
  return {
    id,
    username: 'a.guest',
    caption: 'Night at RIVR',
    mediaUrl: `https://cdn.instagram.test/${id}.jpg`,
    mediaKind: 'image',
    permalink: `https://instagram.test/p/${id}`,
    postedAt: new Date(postedAt),
  };
}

describe('fake Instagram Graph', () => {
  it('starts with no tagged posts, so a real venue without credentials shows an empty wall', async () => {
    expect(await createFakeInstagramGraph().listTaggedPosts({ since: new Date(0), limit: 10 })).toEqual({ ok: true, value: [] });
  });

  it('lists tagged posts since a time, newest first, up to the limit', async () => {
    const graph = createFakeInstagramGraph();
    graph.addTaggedPost(tagged('old', '2026-11-01T12:00:00Z'));
    graph.addTaggedPost(tagged('a', '2026-11-16T12:00:00Z'));
    graph.addTaggedPost(tagged('b', '2026-11-16T14:00:00Z'));
    graph.addTaggedPost(tagged('c', '2026-11-16T13:00:00Z'));

    const listed = await graph.listTaggedPosts({ since: new Date('2026-11-16T00:00:00Z'), limit: 2 });

    expect(listed.ok && listed.value.map((post) => post.id)).toEqual(['b', 'c']);
  });

  it('fails the next call when a test scripts it', async () => {
    const graph = createFakeInstagramGraph();
    graph.failNext({ code: 'rate_limited' });

    expect(await graph.listTaggedPosts({ since: new Date(0), limit: 1 })).toEqual({ ok: false, error: { code: 'rate_limited' } });
  });
});

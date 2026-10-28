// The social wall's pull (#157; decision 0267): pg_cron runs it every five minutes with the scheduler's secret. It asks
// Instagram for the posts that tagged the club in the last week, a post tagged late included, and records the ones
// the club does not hold yet for moderation in the console. The club is the venue the Instagram account belongs to (SOCIAL_VENUE_ID); the database refuses the practice
// venue. Until Instagram's credentials are set it does nothing.
import { createInstagramGraph, pullWallPosts, type TaggedPost } from '@rivr/adapters/instagram-graph';
import { rpc, serveScheduled } from '../_shared/outbox.ts';

const instagramUserId = Deno.env.get('INSTAGRAM_USER_ID') ?? '';
const accessToken = Deno.env.get('INSTAGRAM_ACCESS_TOKEN') ?? '';
const venueId = Deno.env.get('SOCIAL_VENUE_ID') ?? '';
// How far back each pull asks: the database skips the posts it already holds.
const LOOK_BACK_MS = 7 * 24 * 60 * 60 * 1000;

/** The posts as the database records them. */
const rows = (posts: readonly TaggedPost[]) => posts.map((post) => ({
  id: post.id, username: post.username, caption: post.caption, media_url: post.mediaUrl, media_kind: post.mediaKind, permalink: post.permalink,
  posted_at: post.postedAt.toISOString(),
}));

Deno.serve(
  instagramUserId && accessToken && venueId
    ? serveScheduled(() => pullWallPosts({
      instagram: createInstagramGraph({ instagramUserId, accessToken }),
      since: async () => new Date(Date.now() - LOOK_BACK_MS),
      record: async (posts) => Number(await rpc('record_wall_posts', { p_venue_id: venueId, p_posts: rows(posts) })),
    }))
    : () => Response.json({ error: 'Instagram is not configured' }, { status: 503 }),
);

// The nightly channel analytics (#164; decision 0280): pg_cron runs it at 00:00 IST with the scheduler's secret. It reads
// the follower count of each channel the club has connected and records tonight's, for the club venue the channels belong
// to (SOCIAL_VENUE_ID); the database refuses the practice venue. A channel without its secrets is skipped; Google Business
// Profile and WhatsApp give no count.
import { collectFollowerCounts, createChannelAnalytics, followerSources, type FollowerSource } from '@rivr/adapters/channel-analytics';
import { SOCIAL_CHANNELS, type SocialChannel } from '@rivr/contracts';
import { rpc, serveScheduled } from '../_shared/outbox.ts';

const secret = (name: string) => Deno.env.get(name) ?? '';
const venueId = secret('SOCIAL_VENUE_ID');

/** A channel's source when both its secrets are set. */
function source(first: string, second: string, make: (a: string, b: string) => FollowerSource): FollowerSource | undefined {
  return secret(first) && secret(second) ? make(secret(first), secret(second)) : undefined;
}

const candidates: [SocialChannel, FollowerSource | undefined][] = [
  ['instagram', source('INSTAGRAM_USER_ID', 'INSTAGRAM_ACCESS_TOKEN', followerSources.instagram)],
  ['facebook', source('FACEBOOK_PAGE_ID', 'FACEBOOK_PAGE_TOKEN', followerSources.facebook)],
  ['x', source('X_USER_ID', 'X_BEARER_TOKEN', followerSources.x)],
  ['linkedin', source('LINKEDIN_ORGANIZATION_ID', 'LINKEDIN_ACCESS_TOKEN', followerSources.linkedin)],
  ['youtube', source('YOUTUBE_CHANNEL_ID', 'YOUTUBE_API_KEY', followerSources.youtube)],
  ['telegram', source('TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHANNEL', followerSources.telegram)],
];
const sources = Object.fromEntries(candidates.filter(([, found]) => found !== undefined));

Deno.serve(
  venueId
    ? serveScheduled(async () => {
      const { counts, failed } = await collectFollowerCounts(createChannelAnalytics({ sources }), SOCIAL_CHANNELS);
      const rows = counts.map(({ channel, followers }) => ({ channel, followers }));
      const recorded = rows.length === 0 ? 0 : Number(await rpc('record_channel_followers', { p_venue_id: venueId, p_counts: rows }));
      return { recorded, failed };
    })
    : () => Response.json({ error: 'SOCIAL_VENUE_ID is not set' }, { status: 503 }),
);

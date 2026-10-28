import { SOCIAL_CHANNELS } from '@rivr/contracts';
import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

// Kept here, not in queryKeys: this module is its own subpath (@rivr/db/social). The TV's wall is in queryKeys, for useTvSignals.
const keys = {
  wall: (userId: string, venueId: string) => ['user', userId, 'wall-posts', venueId] as const,
  leads: (userId: string, venueId: string) => ['user', userId, 'leads', venueId] as const,
  posts: (userId: string, venueId: string) => ['user', userId, 'social-posts', venueId] as const,
};

/** Where a post stands on the social wall. */
export type WallStatus = 'pending' | 'approved' | 'rejected';
const STATUSES: readonly WallStatus[] = ['pending', 'approved', 'rejected'];

/** A public Instagram post that tags the club (#157), for moderation. */
export interface WallPost {
  readonly postId: string;
  readonly handle: string;
  readonly caption: string;
  readonly mediaUrl: string;
  readonly permalink: string;
  readonly postedAt: string;
  readonly status: WallStatus;
}

/** Why a post was not moderated: the role, gone, the venue frozen, or anything else. */
export type WallFailure = 'not_allowed' | 'gone' | 'paused' | 'unavailable';
const FAILURE_BY_CODE: Readonly<Record<string, WallFailure>> = { '42501': 'not_allowed', P0002: 'gone', RVFRZ: 'paused' };

// The queue shows the newest posts; older ones have been moderated long since.
const SHOWN = 50;

/** The wall's posts, newest first, for staff who publish marketing. */
export function useWallPosts(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: keys.wall(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<WallPost[]> => {
      const { data, error } = await client.from('wall_post').select('id, handle, caption, media_url, permalink, posted_at, status').eq('venue_id', venueId)
        .order('posted_at', { ascending: false }).limit(SHOWN);
      if (error) throw error;
      return data.map((row) => ({
        postId: row.id, handle: row.handle, caption: row.caption, mediaUrl: row.media_url, permalink: row.permalink, postedAt: row.posted_at,
        status: STATUSES.find((status) => status === row.status) ?? 'pending',
      }));
    },
  });
}

/** Approves a post for the wall, or rejects it; a Result, and the queue reloads. */
export function useModerateWallPost(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, isApproved }: { postId: string; isApproved: boolean }): Promise<Result<null, WallFailure>> => {
      const { error } = await client.rpc('moderate_wall_post', { p_venue_id: venueId, p_post_id: postId, p_is_approved: isApproved });
      await queryClient.invalidateQueries({ queryKey: keys.wall(userId ?? 'signed-out', venueId) });
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(null);
    },
  });
}

/** A conversation on Instagram, Facebook or WhatsApp (#156), and the member it became, if any. */
export interface Lead {
  readonly leadId: string;
  readonly channel: 'instagram' | 'facebook' | 'whatsapp';
  readonly handle: string;
  readonly firstMessage: string;
  readonly lastMessageAt: string;
  readonly messages: number;
  readonly memberName: string | null;
}
const CHANNELS: readonly Lead['channel'][] = ['instagram', 'facebook', 'whatsapp'];

/** The venue's leads, the latest conversation first, for staff who publish marketing. */
export function useLeads(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: keys.leads(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<Lead[]> => {
      const { data, error } = await client.rpc('venue_leads', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({
        leadId: row.lead_id, channel: CHANNELS.find((channel) => channel === row.channel) ?? 'whatsapp', handle: row.handle, firstMessage: row.first_message,
        lastMessageAt: row.last_message_at, messages: row.messages, memberName: row.member_name,
      }));
    },
  });
}

/** The social channels a post goes to (#154), as packages/contracts lists them. */
export type SocialChannel = (typeof SOCIAL_CHANNELS)[number];

/** A published post: its caption and image, and each channel's state: to download and post, or published with its link. */
export interface SocialPost {
  readonly postId: string;
  readonly caption: string;
  readonly imageUrl: string;
  readonly createdAt: string;
  readonly channels: readonly { readonly channel: SocialChannel; readonly postUrl: string | null }[];
}

/** Why a post was not published: the role, no image or channel, social publishing off or the venue frozen, or anything else. */
export type PublishFailure = 'not_allowed' | 'invalid' | 'paused' | 'unavailable';
const PUBLISH_FAILURE: Readonly<Record<string, PublishFailure>> = { '42501': 'not_allowed', '22023': 'invalid', RVFRZ: 'paused', RVKIL: 'paused' };
const MEDIA_BUCKET = 'social-media';
const EXTENSIONS: Readonly<Record<string, string>> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** The venue's last twenty posts, newest first, for staff who publish marketing. */
export function useSocialPosts(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: keys.posts(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<SocialPost[]> => {
      const { data, error } = await client.from('social_post').select('id, caption, image_path, created_at, social_post_channel(channel, post_url)')
        .eq('venue_id', venueId).order('created_at', { ascending: false }).limit(20);
      if (error) throw error;
      return data.map((row) => ({
        postId: row.id, caption: row.caption, createdAt: row.created_at, imageUrl: client.storage.from(MEDIA_BUCKET).getPublicUrl(row.image_path).data.publicUrl,
        channels: row.social_post_channel.flatMap((each) => {
          const channel = SOCIAL_CHANNELS.find((known) => known === each.channel);
          return channel === undefined ? [] : [{ channel, postUrl: each.post_url }];
        }),
      }));
    },
  });
}

/** Uploads the image, then publishes the post to its channels; a Result, and the posts reload. */
export function usePublishSocialPost(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (post: { caption: string; image: File; channels: readonly SocialChannel[] }): Promise<Result<string, PublishFailure>> => {
      const extension = EXTENSIONS[post.image.type];
      if (extension === undefined) return err('invalid');
      const path = `${venueId}/${crypto.randomUUID()}.${extension}`;
      const stored = await client.storage.from(MEDIA_BUCKET).upload(path, post.image, { contentType: post.image.type });
      if (stored.error) return err('unavailable');
      const { data, error } = await client.rpc('publish_social_post', { p_venue_id: venueId, p_caption: post.caption, p_image_path: path, p_channels: [...post.channels] });
      await queryClient.invalidateQueries({ queryKey: keys.posts(userId ?? 'signed-out', venueId) });
      return error ? err(PUBLISH_FAILURE[error.code] ?? 'unavailable') : ok(data);
    },
  });
}

/** An approved post on the TV's social wall. */
export interface TvWallPost {
  readonly handle: string;
  readonly caption: string;
}

// An approval tells the TV at once (useTvSignals); it also asks again every half minute.
const TV_BOARD_CHECK = 30_000;

/** The paired TV's social wall (#158): the newest approved posts, while it is its mode or in its rotation. */
export function useTvSocialWall() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.tvSocialWall(userId ?? 'signed-out'),
    enabled: userId !== null,
    refetchInterval: TV_BOARD_CHECK,
    queryFn: async (): Promise<TvWallPost[]> => {
      const { data, error } = await client.rpc('tv_social_wall');
      if (error) throw error;
      return data.map((row) => ({ handle: row.handle, caption: row.caption }));
    },
  });
}

import { z } from 'zod';
import type { SettingDefinition } from './settingDefinition.ts';

/** Every channel RIVR publishes to, in the order the console lists them. */
export const SOCIAL_CHANNELS = [
  'instagram',
  'facebook',
  'x',
  'linkedin',
  'youtube',
  'telegram',
  'google_business_profile',
  'whatsapp',
] as const;

/** A publishing channel. */
export const socialChannelSchema = z.enum(SOCIAL_CHANNELS);
/** A publishing channel. */
export type SocialChannel = z.infer<typeof socialChannelSchema>;

/** The channels the club has connected (#586): a post goes out to these through their APIs, the others to download and post. */
export const socialConnectedChannels = {
  key: 'social.connected_channels',
  description: 'The social channels the club has connected, with their secrets set: a post goes out to these by itself, and the others offer it to download and post. None set is none.',
  scope: 'venue',
  value: z.strictObject({ channels: z.array(socialChannelSchema).max(8) }),
} as const satisfies SettingDefinition;

/** A post as the console's publish form takes it (#154): its caption, and the channels it goes to. */
export const socialPostSchema = z.object({
  caption: z.string().trim().min(1).max(2200),
  channels: z.array(socialChannelSchema).min(1),
});

/** The channels whose messages reach the social inbox. */
export const INBOX_CHANNELS = ['instagram', 'facebook', 'whatsapp'] as const;

/** A channel the social inbox reads. */
export const inboxChannelSchema = z.enum(INBOX_CHANNELS);
/** A channel the social inbox reads. */
export type InboxChannel = z.infer<typeof inboxChannelSchema>;

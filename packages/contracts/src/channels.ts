import { z } from 'zod';

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

/** The channels whose messages reach the social inbox. */
export const INBOX_CHANNELS = ['instagram', 'facebook', 'whatsapp'] as const;

/** A channel the social inbox reads. */
export const inboxChannelSchema = z.enum(INBOX_CHANNELS);
/** A channel the social inbox reads. */
export type InboxChannel = z.infer<typeof inboxChannelSchema>;

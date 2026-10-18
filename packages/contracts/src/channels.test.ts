import { describe, expect, it } from 'vitest';
import { INBOX_CHANNELS, SOCIAL_CHANNELS, inboxChannelSchema, socialChannelSchema } from './channels.ts';

describe('social channels', () => {
  it('publishes to the eight channels in the spec', () => {
    expect(SOCIAL_CHANNELS).toEqual([
      'instagram',
      'facebook',
      'x',
      'linkedin',
      'youtube',
      'telegram',
      'google_business_profile',
      'whatsapp',
    ]);
  });

  it('reads the inbox from Instagram, Facebook and WhatsApp only', () => {
    expect(INBOX_CHANNELS).toEqual(['instagram', 'facebook', 'whatsapp']);
    expect(inboxChannelSchema.safeParse('x').success).toBe(false);
  });

  it('rejects a channel that is not a target', () => {
    expect(socialChannelSchema.parse('telegram')).toBe('telegram');
    expect(socialChannelSchema.safeParse('tiktok').success).toBe(false);
  });
});

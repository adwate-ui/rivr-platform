import type { SocialChannel } from '@rivr/contracts';

/** One value for every publishing channel, keyed by channel in the order the console lists them. */
export function byChannel<Value>(make: (channel: SocialChannel) => Value): { readonly [Channel in SocialChannel]: Value } {
  return {
    instagram: make('instagram'),
    facebook: make('facebook'),
    x: make('x'),
    linkedin: make('linkedin'),
    youtube: make('youtube'),
    telegram: make('telegram'),
    google_business_profile: make('google_business_profile'),
    whatsapp: make('whatsapp'),
  };
}

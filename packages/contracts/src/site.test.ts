import { describe, expect, it } from 'vitest';
import { PLAYER_DESTINATIONS, siteBlockSchema } from './site.ts';

describe('siteBlockSchema', () => {
  it('reads a hero with its hand-off to the player app, and a text block', () => {
    expect(siteBlockSchema.parse({ kind: 'hero', content: { heading: 'RIVR Poker Club', action: { label: 'Join RIVR', to: 'sign-up' } } })).toEqual({
      kind: 'hero', content: { heading: 'RIVR Poker Club', action: { label: 'Join RIVR', to: 'sign-up' } },
    });
    expect(siteBlockSchema.parse({ kind: 'text', content: { body: 'Training only.' } })).toEqual({ kind: 'text', content: { body: 'Training only.' } });
  });

  it('refuses a block it does not know, and a link anywhere but the player app\'s destinations', () => {
    expect(siteBlockSchema.safeParse({ kind: 'video', content: { url: 'x' } }).success).toBe(false);
    expect(siteBlockSchema.safeParse({ kind: 'hero', content: { heading: 'Hi', action: { label: 'Go', to: 'https://evil.example' } } }).success).toBe(false);
  });

  it('knows where each destination is in the player app', () => {
    expect(PLAYER_DESTINATIONS).toEqual({ 'sign-up': '/sign-in', academy: '/academy' });
  });
});

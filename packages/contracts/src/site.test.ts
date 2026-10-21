import { describe, expect, it } from 'vitest';
import { PLAYER_DESTINATIONS, siteBlockSchema } from './site.ts';

describe('siteBlockSchema', () => {
  it('reads a hero with its hand-off to the player app, and a text block', () => {
    expect(siteBlockSchema.parse({ kind: 'hero', content: { heading: 'RIVR Poker Club', action: { label: 'Join RIVR', to: 'sign-up' } } })).toEqual({
      kind: 'hero', content: { heading: 'RIVR Poker Club', action: { label: 'Join RIVR', to: 'sign-up' } },
    });
    expect(siteBlockSchema.parse({ kind: 'text', content: { body: 'Training only.' } })).toEqual({ kind: 'text', content: { body: 'Training only.' } });
  });

  it('keeps a hero whose line under the heading was left blank, with its action', () => {
    const hero = siteBlockSchema.parse({ kind: 'hero', content: { heading: 'RIVR', text: '   ', action: { label: 'Join RIVR', to: 'sign-up' } } });
    expect(hero.content).toEqual({ heading: 'RIVR', text: '', action: { label: 'Join RIVR', to: 'sign-up' } });
  });

  it('refuses a block it does not know, and a link anywhere but the player app\'s destinations', () => {
    expect(siteBlockSchema.safeParse({ kind: 'video', content: { url: 'x' } }).success).toBe(false);
    expect(siteBlockSchema.safeParse({ kind: 'hero', content: { heading: 'Hi', action: { label: 'Go', to: 'https://evil.example' } } }).success).toBe(false);
  });

  it('reads the front page\'s media blocks', () => {
    const tile = { image: '/media/dealers.webp', alt: 'A dealer at a table', title: 'Casino-trained dealers' };
    const hero = siteBlockSchema.parse({ kind: 'hero', content: {
      eyebrow: 'RIVR Poker Club', heading: 'Bring your poker face.', video: { src: '/media/hero-room.mp4', poster: '/media/hero-room.webp' }, note: 'Concept visualisation',
    } });
    expect(hero.content).toMatchObject({ video: { src: '/media/hero-room.mp4', poster: '/media/hero-room.webp' } });
    expect(siteBlockSchema.safeParse({ kind: 'statement', content: { lines: ['Not luck.', 'A game of skill.'] } }).success).toBe(true);
    expect(siteBlockSchema.safeParse({ kind: 'gallery', content: { heading: 'Built for the long session.', items: [tile, tile] } }).success).toBe(true);
    expect(siteBlockSchema.safeParse({ kind: 'feature', content: { heading: 'The RIVR app', image: '/media/app-home.webp', alt: 'The app' } }).success).toBe(true);
  });

  it('refuses media from anywhere but the website\'s own, and a gallery of one tile', () => {
    const tile = { image: '/media/dealers.webp', alt: 'A dealer', title: 'Dealers' };
    const video = (src: string) => ({ kind: 'hero', content: { heading: 'RIVR', video: { src, poster: '/media/hero-room.webp' } } });
    expect(siteBlockSchema.safeParse(video('https://evil.example/room.mp4')).success).toBe(false);
    expect(siteBlockSchema.safeParse(video('/media/../secrets.mp4')).success).toBe(false);
    expect(siteBlockSchema.safeParse({ kind: 'gallery', content: { items: [{ ...tile, image: '/media/x.png' }, tile] } }).success).toBe(false);
    expect(siteBlockSchema.safeParse({ kind: 'gallery', content: { items: [tile] } }).success).toBe(false);
    expect(siteBlockSchema.safeParse({ kind: 'statement', content: { lines: [] } }).success).toBe(false);
  });

  it('knows where each destination is in the player app', () => {
    expect(PLAYER_DESTINATIONS).toEqual({ 'sign-up': '/sign-in', academy: '/academy', waitlist: '/' });
  });
});

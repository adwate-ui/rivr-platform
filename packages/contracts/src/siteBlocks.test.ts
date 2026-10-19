import { describe, expect, it } from 'vitest';
import { SITE_BLOCK_KINDS, siteBlockSchema } from './site.ts';

const DIRECTIONS = 'https://www.google.com/maps/search/?api=1&query=Glaza%2C%20M3M%2065th%20Avenue%2C%20Gurugram';

describe('the website\'s information blocks (#35)', () => {
  it('lists every kind the database allows', () => {
    expect(SITE_BLOCK_KINDS).toEqual(['hero', 'text', 'rules', 'faq', 'careers', 'map', 'games', 'calendar']);
  });

  it('reads house rules, questions, careers and a map', () => {
    expect(siteBlockSchema.safeParse({ kind: 'rules', content: { heading: 'House rules', rules: ['One player to a hand.'] } }).success).toBe(true);
    expect(siteBlockSchema.safeParse({ kind: 'faq', content: { questions: [{ question: 'Who can join?', answer: 'Anyone 18 or over.' }] } }).success).toBe(true);
    expect(siteBlockSchema.safeParse({ kind: 'careers', content: { roles: [], apply: 'Openings soon.' } }).success).toBe(true);
    expect(siteBlockSchema.safeParse({ kind: 'map', content: { address: 'Upper floor, Glaza, Gurugram', directionsUrl: DIRECTIONS } }).success).toBe(true);
  });

  it('leaves out a block with nothing in it', () => {
    expect(siteBlockSchema.safeParse({ kind: 'rules', content: { rules: [] } }).success).toBe(false);
    expect(siteBlockSchema.safeParse({ kind: 'faq', content: { questions: [{ question: ' ', answer: 'x' }] } }).success).toBe(false);
  });

  it('sends a visitor for directions only to Google Maps, over HTTPS', () => {
    const map = (directionsUrl: string) => siteBlockSchema.safeParse({ kind: 'map', content: { address: 'Glaza', directionsUrl } }).success;
    expect(map('https://maps.app.goo.gl/abc123')).toBe(true);
    expect(map('http://www.google.com/maps')).toBe(false);
    expect(map('https://evil.example/maps')).toBe(false);
    expect(map('javascript:alert(1)')).toBe(false);
    // Google, but not a maps page: its redirects and search could send a visitor anywhere.
    expect(map('https://www.google.com/url?q=https://evil.example/')).toBe(false);
    expect(map('https://maps.google.com/url?q=https://evil.example/')).toBe(false);
    expect(map('https://www.google.com/search?q=rivr')).toBe(false);
    expect(map('https://evil.example@www.google.com/maps')).toBe(false);
    expect(map('https://www.google.com/maps/place/Glaza')).toBe(true);
  });
});

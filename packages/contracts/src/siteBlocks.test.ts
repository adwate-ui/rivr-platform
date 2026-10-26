import { describe, expect, it } from 'vitest';
import { SITE_BLOCK_KINDS, siteBlockSchema } from './site.ts';

const DIRECTIONS = 'https://www.google.com/maps/search/?api=1&query=Glaza%2C%20M3M%2065th%20Avenue%2C%20Gurugram';

describe('the website\'s information blocks (#35)', () => {
  it('lists every kind the database allows', () => {
    expect(SITE_BLOCK_KINDS).toEqual([
      'hero', 'statement', 'gallery', 'feature', 'text', 'rules', 'faq', 'careers', 'map', 'games', 'calendar', 'links',
      'story', 'cards', 'marquee', 'timeline', 'table', 'promotions',
    ]);
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

  it('reads a links block of named player-app destinations, one to six, never a raw address (#39)', () => {
    const links = (items: unknown[]) => siteBlockSchema.safeParse({ kind: 'links', content: { links: items } }).success;
    expect(links([{ label: 'Join the waitlist', to: 'waitlist' }, { label: 'Book RIVR Academy', to: 'academy' }])).toBe(true);
    expect(links([{ label: 'Win big', to: 'https://evil.example/' }])).toBe(false);
    expect(links([])).toBe(false);
    expect(links(Array.from({ length: 7 }, () => ({ label: 'Join RIVR', to: 'sign-up' })))).toBe(false);
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

describe('the website’s bands in grandpokerarena.com’s way (decision 0166)', () => {
  const parse = (block: unknown) => siteBlockSchema.safeParse(block).success;

  it('reads a story, with its photo named only with what it shows', () => {
    const story = { heading: 'Good hands.', paragraphs: ['RIVR opens.'], figures: [{ value: '6', label: 'Tables' }] };
    expect(parse({ kind: 'story', content: story })).toBe(true);
    expect(parse({ kind: 'story', content: { ...story, image: '/media/room.webp', alt: 'The room' } })).toBe(true);
    expect(parse({ kind: 'story', content: { ...story, image: '/media/room.webp' } })).toBe(false);
    expect(parse({ kind: 'story', content: { ...story, paragraphs: [] } })).toBe(false);
  });

  it('reads cards that link only to the website’s own pages', () => {
    const cards = (link: unknown) => parse({ kind: 'cards', content: { cards: [{ title: 'Play' }, { title: 'Connect', link }] } });
    expect(cards({ label: 'See membership', page: 'membership' })).toBe(true);
    expect(cards({ label: 'Elsewhere', page: 'https://evil.example/' })).toBe(false);
    expect(cards({ label: 'Up', page: '../admin' })).toBe(false);
    expect(parse({ kind: 'cards', content: { cards: [{ title: 'Alone' }] } })).toBe(false);
  });

  it('reads phrases, moments and a table whose rows are as long as its columns', () => {
    expect(parse({ kind: 'marquee', content: { phrases: ['Play', 'Connect'] } })).toBe(true);
    expect(parse({ kind: 'timeline', content: { items: [{ when: '1996', title: 'The predominance test' }] } })).toBe(true);
    const table = (rows: string[][]) => parse({ kind: 'table', content: { columns: ['Stake', 'Points an hour'], rows } });
    expect(table([['NLH 50/100', '5']])).toBe(true);
    expect(table([['NLH 50/100', '5', 'extra']])).toBe(false);
  });

  it('reads the live promotions, and a map with the club’s number and email', () => {
    expect(parse({ kind: 'promotions', content: { heading: 'Running now' } })).toBe(true);
    const map = (extra: object) => parse({ kind: 'map', content: { address: 'Glaza', directionsUrl: DIRECTIONS, ...extra } });
    expect(map({ phone: '+919000000000', email: 'info@rivrpoker.com' })).toBe(true);
    expect(map({ phone: '9000000000' })).toBe(false);
    expect(map({ email: 'not an email' })).toBe(false);
  });
});

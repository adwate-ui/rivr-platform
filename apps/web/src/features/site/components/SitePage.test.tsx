import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SitePage } from './SitePage.tsx';

afterEach(cleanup);

const PAGE = {
  slug: 'home',
  title: 'RIVR Poker Club',
  description: null,
  blocks: [
    { kind: 'hero' as const, content: { heading: 'RIVR Poker Club', text: 'Opens Sunday 15 November.', action: { label: 'Join RIVR', to: 'sign-up' as const } } },
    { kind: 'text' as const, content: { heading: "A members' club", body: 'Cash games every night.' } },
  ],
  navigation: [{ slug: 'academy', title: 'RIVR Academy' }],
  games: [],
  tournaments: [], promotions: [],
};

describe('a website page', () => {
  it('shows its blocks in order under the navigation', () => {
    render(<SitePage page={PAGE} playerUrl="https://player.invalid" attribution={null} />);
    expect(screen.getByRole('heading', { level: 1, name: 'RIVR Poker Club' })).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: "A members' club" })).toBeDefined();
    expect(screen.getByRole('link', { name: 'RIVR Academy' }).getAttribute('href')).toBe('/academy');
    expect(screen.getByRole('link', { name: 'Join RIVR' }).getAttribute('href')).toBe('https://player.invalid/sign-in');
  });

  it('carries the codes the visitor arrived with on every link, into the player app and across the website', () => {
    render(<SitePage page={PAGE} playerUrl="https://player.invalid" attribution={{ referral: 'FRIEND1', utmSource: 'instagram' }} />);
    expect(screen.getByRole('link', { name: 'Join RIVR' }).getAttribute('href')).toBe('https://player.invalid/sign-in?ref=FRIEND1&utm_source=instagram');
    expect(screen.getByRole('link', { name: 'RIVR Academy' }).getAttribute('href')).toBe('/academy?ref=FRIEND1&utm_source=instagram');
  });

  it('joins the player app\'s address however it was written', () => {
    render(<SitePage page={PAGE} playerUrl="https://player.invalid/" attribution={null} />);
    expect(screen.getByRole('link', { name: 'Join RIVR' }).getAttribute('href')).toBe('https://player.invalid/sign-in');
  });

  it('draws the front page\'s blocks in their bands, under the header\'s action and over the footer', () => {
    const front = {
      ...PAGE,
      blocks: [
        { kind: 'hero' as const, content: {
          heading: 'Bring your poker face.', action: { label: 'Join RIVR', to: 'sign-up' as const },
          video: { src: '/media/hero-room.mp4', poster: '/media/hero-room.webp' }, note: 'Concept visualisation',
        } },
        { kind: 'statement' as const, content: { lines: ['Not luck.', 'A game of skill.'] } },
        { kind: 'gallery' as const, content: { heading: 'Built for the long session.', items: [
          { image: '/media/dealers.webp', alt: 'A dealer deals at a table', title: 'Casino-trained dealers' },
          { image: '/media/cashier.webp', alt: 'A cashier counts chips', title: 'Instant, secure cashier' },
        ] } },
        { kind: 'feature' as const, content: {
          heading: 'Done waiting for a seat?', image: '/media/app-home.webp', alt: 'The RIVR app', action: { label: 'Join the waitlist', to: 'waitlist' as const },
        } },
      ],
    };
    const { container } = render(<SitePage page={front} playerUrl="https://player.invalid" attribution={{ referral: 'FRIEND1' }} />);
    expect(Array.from(container.querySelectorAll('[data-band]'), (band) => band.getAttribute('data-band'))).toEqual(['dark', 'deep', 'cream', 'dark']);
    expect(screen.getByRole('heading', { level: 1, name: 'Bring your poker face.' })).toBeDefined();
    expect(screen.getByRole('img', { name: 'A dealer deals at a table' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Join the waitlist' }).getAttribute('href')).toBe('https://player.invalid/?ref=FRIEND1');
    expect(screen.getByRole('link', { name: 'Reserve a seat' }).getAttribute('href')).toBe('https://player.invalid/?ref=FRIEND1');
    expect(screen.getByText('Strictly 18+. Poker is a game of skill.')).toBeDefined();
  });

  it('draws the live blocks from the rows the page loaded', () => {
    const live = {
      ...PAGE,
      blocks: [{ kind: 'games' as const, content: { heading: 'Games and stakes' } }, { kind: 'calendar' as const, content: {} }],
      games: [{ name: 'NLH 50/100', smallBlind: 5000n, bigBlind: 10000n, buyInMin: 500000n, buyInMax: 500000n, straddle: null, tablesOpen: 1, waiting: 3 }],
      tournaments: [{ name: 'RIVR Sunday', startsAt: new Date('2026-11-15T10:30:00Z'), buyIn: 1000000n, guarantee: 50000000n }],
    };
    render(<SitePage page={live} playerUrl="https://player.invalid/" attribution={null} />);
    expect(screen.getByText('1 table running · 3 waiting')).toBeDefined();
    expect(screen.getByText('Sunday 15 Nov 2026, 16:00')).toBeDefined();
  });

  it('draws the bands added in grandpokerarena.com’s way, with the live promotions, a card’s page link and the footer’s policies (decision 0166)', () => {
    const page = {
      ...PAGE,
      blocks: [
        { kind: 'marquee' as const, content: { phrases: ['Play', 'Connect'] } },
        { kind: 'story' as const, content: { heading: 'Good hands. Better company.', paragraphs: ['RIVR opens.'], figures: [{ value: '6', label: 'Tables' }] } },
        { kind: 'cards' as const, content: { heading: 'What’s on', cards: [{ title: 'Tournament nights', link: { label: 'Full calendar', page: 'tournaments' } }, { title: 'On the house' }] } },
        { kind: 'timeline' as const, content: { items: [{ when: '1996', title: 'The predominance test' }] } },
        { kind: 'table' as const, content: { columns: ['Stake', 'Points an hour'], rows: [['NLH 50/100', '5']] } },
        { kind: 'promotions' as const, content: { heading: 'Running now' } },
      ],
      promotions: [{ title: 'Referral', detail: '₹1,000 to each side', runs: 'Every day' }],
    };
    const { container } = render(<SitePage page={page} playerUrl="https://player.invalid" attribution={{ referral: 'FRIEND1' }} />);
    expect(Array.from(container.querySelectorAll('[data-band]'), (band) => band.getAttribute('data-band'))).toEqual(['deep', 'cream', 'dark', 'deep', 'cream', 'deep']);
    expect(screen.getByRole('heading', { level: 2, name: 'Good hands. Better company.' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Full calendar' }).getAttribute('href')).toBe('/tournaments?ref=FRIEND1');
    expect(screen.getByRole('cell', { name: '5' })).toBeDefined();
    expect(screen.getByRole('heading', { level: 3, name: 'Referral' })).toBeDefined();
    expect(screen.getByRole('contentinfo').querySelector('a[href="/house-rules?ref=FRIEND1"]')?.textContent).toBe('House rules');
  });
});

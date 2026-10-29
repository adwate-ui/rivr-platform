import { cleanup, render, screen, within } from '@testing-library/react';
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
  tournaments: [], promotions: [], wallPosts: [], isPaused: false,
};

describe('a website page', () => {
  it('shows its blocks in order under the menu', () => {
    render(<SitePage page={PAGE} playerUrl="https://player.invalid" attribution={null} />);
    expect(screen.getByRole('heading', { level: 1, name: 'RIVR Poker Club' })).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: "A members' club" })).toBeDefined();
    expect(screen.getByRole('link', { name: 'The Club' }).getAttribute('href')).toBe('/about');
    expect(screen.getByRole('link', { name: 'Join RIVR' }).getAttribute('href')).toBe('https://player.invalid/sign-in');
  });

  it('carries the codes the visitor arrived with on every link, into the player app and across the website', () => {
    render(<SitePage page={PAGE} playerUrl="https://player.invalid" attribution={{ referral: 'FRIEND1', utmSource: 'instagram' }} />);
    expect(screen.getByRole('link', { name: 'Join RIVR' }).getAttribute('href')).toBe('https://player.invalid/sign-in?ref=FRIEND1&utm_source=instagram');
    const menu = screen.getByRole('navigation', { name: 'Site' });
    expect(within(menu).getByRole('link', { name: 'Membership' }).getAttribute('href')).toBe('/membership?ref=FRIEND1&utm_source=instagram');
    expect(within(menu).getByRole('link', { name: 'The Room' }).getAttribute('href')).toBe('/?ref=FRIEND1&utm_source=instagram#the-room');
    expect(screen.getAllByRole('link', { name: 'Member app' })[0]?.getAttribute('href')).toBe('https://player.invalid/?ref=FRIEND1&utm_source=instagram');
  });

  it('has grandpokerarena.com’s menu, top bar, footer columns and cookie banner, and no Academy in the menu', () => {
    render(<SitePage page={PAGE} playerUrl="https://player.invalid" attribution={null} />);
    const menu = screen.getByRole('navigation', { name: 'Site' });
    expect(within(menu).getAllByRole('link').map((link) => link.textContent)).toEqual([
      'The Club', 'The Room', 'Games', 'Membership', 'Leaderboard', "What's On", 'Prizes & Calendar', 'Journal', 'Visit & Contact',
    ]);
    const reserve = screen.getByRole('link', { name: 'Reserve a seat' }).getAttribute('href') ?? '';
    expect(reserve.startsWith('https://wa.me/')).toBe(true);
    expect(new URL(reserve).searchParams.get('text')).toBe('Hi RIVR, I would like to reserve a seat tonight.');
    expect(within(screen.getByRole('list', { name: 'Contact' })).getAllByRole('link').map((link) => link.textContent)).toEqual([
      '+91 00000 00000', 'WhatsApp', 'Instagram', 'YouTube', 'info@rivrpoker.com',
    ]);
    expect(screen.getAllByRole('link', { name: 'Member app' }).map((link) => link.getAttribute('href'))).toEqual(['https://player.invalid/', 'https://player.invalid/']);
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getAllByRole('navigation').map((column) => column.getAttribute('aria-label'))).toEqual(['The club', 'Play', 'Policies', 'Need to talk?']);
    expect(within(footer).getByRole('link', { name: 'Legal standing' }).getAttribute('href')).toBe('/about#legal-and-compliance');
    expect(within(footer).getByRole('link', { name: 'Tele-MANAS 14416 (24 hours)' }).getAttribute('href')).toBe('tel:14416');
    expect(document.querySelector('[data-cookie-banner]')).not.toBeNull();
  });

  it('gives each band the anchor of its eyebrow, or of its kind, once a page', () => {
    const page = {
      ...PAGE,
      blocks: [
        { kind: 'cards' as const, content: { eyebrow: 'The room', heading: 'Everything around the felt.', cards: [{ title: 'Six tables' }] } },
        { kind: 'games' as const, content: { heading: 'Pick your table.' } },
        { kind: 'cards' as const, content: { eyebrow: 'The room', heading: 'Again', cards: [{ title: 'Kitchen' }] } },
      ],
    };
    const { container } = render(<SitePage page={page} playerUrl="https://player.invalid" attribution={null} />);
    expect(Array.from(container.querySelectorAll('[data-band]'), (band) => band.id)).toEqual(['the-room', 'games', '']);
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
    expect(screen.getByText('Strictly 18+. Poker is a game of skill.')).toBeDefined();
  });

  it('draws the live blocks from the rows the page loaded', () => {
    const live = {
      ...PAGE,
      blocks: [{ kind: 'games' as const, content: { heading: 'Games and stakes' } }, { kind: 'calendar' as const, content: {} }],
      games: [{ name: 'NLH 50/100', smallBlind: 5000n, bigBlind: 10000n, buyInMin: 500000n, buyInMax: 500000n, straddle: null, tablesOpen: 1, openSeats: 2, waiting: 3 }],
      tournaments: [{ name: 'RIVR Sunday', startsAt: new Date('2026-11-15T10:30:00Z'), buyIn: 1000000n, guarantee: 50000000n }],
    };
    render(<SitePage page={live} playerUrl="https://player.invalid/" attribution={null} />);
    expect(screen.getByText('1 table running · 2 open seats · 3 waiting')).toBeDefined();
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
    expect(screen.getByRole('link', { name: 'Full calendar: Tournament nights' }).getAttribute('href')).toBe('/tournaments?ref=FRIEND1');
    expect(screen.getByRole('cell', { name: '5' })).toBeDefined();
    expect(screen.getByRole('heading', { level: 3, name: 'Referral' })).toBeDefined();
    expect(screen.getByRole('contentinfo').querySelector('a[href="/house-rules?ref=FRIEND1"]')?.textContent).toBe('House rules');
  });

  it('shows the social wall’s approved posts with their links, and no block while there are none', () => {
    const wall = { kind: 'social_wall' as const, content: { heading: 'On Instagram' } };
    const posts = [{ handle: 'zoya.plays', caption: 'Final table at RIVR', permalink: 'https://www.instagram.com/p/1/' }];
    render(<SitePage page={{ ...PAGE, blocks: [wall], wallPosts: posts }} playerUrl="https://player.invalid" attribution={null} />);
    expect(screen.getByRole('heading', { name: 'On Instagram' })).toBeDefined();
    expect(screen.getByText('@zoya.plays')).toBeDefined();
    expect(screen.getByRole('link', { name: /See it on Instagram/ }).getAttribute('href')).toBe('https://www.instagram.com/p/1/');
    cleanup();
    render(<SitePage page={{ ...PAGE, blocks: [wall] }} playerUrl="https://player.invalid" attribution={null} />);
    expect(screen.queryByRole('heading', { name: 'On Instagram' })).toBeNull();
  });
});

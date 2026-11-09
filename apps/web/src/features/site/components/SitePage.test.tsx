import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
  league: { month: null, season: null },
  rules: { pointsPerHour: [], rakebackBasisPoints: [], hotelNightHours: [], rewardsRakeShareBasisPoints: null, cabVisits: null, leaguePrizes: { month: null, season: null },
    badBeat: null, highHands: null },
  jackpotPool: null,
};

describe('a website page', () => {
  it('shows its blocks in order under the menu', () => {
    render(<SitePage page={PAGE} playerUrl="https://player.invalid" attribution={null} />);
    expect(screen.getByRole('heading', { level: 1, name: 'RIVR Poker Club' })).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: "A members' club" })).toBeDefined();
    expect(screen.getByRole('link', { name: 'The club' }).getAttribute('href')).toBe('/about');
    expect(screen.getByRole('link', { name: 'Join RIVR' }).getAttribute('href')).toBe('https://player.invalid/sign-in');
  });

  it('carries the codes the visitor arrived with on every link, into the player app and across the website', () => {
    render(<SitePage page={PAGE} playerUrl="https://player.invalid" attribution={{ referral: 'FRIEND1', utmSource: 'instagram' }} />);
    expect(screen.getByRole('link', { name: 'Join RIVR' }).getAttribute('href')).toBe('https://player.invalid/sign-in?ref=FRIEND1&utm_source=instagram');
    const menu = screen.getByRole('navigation', { name: 'Site' });
    expect(within(menu).getByRole('link', { name: 'Membership' }).getAttribute('href')).toBe('/membership?ref=FRIEND1&utm_source=instagram');
    expect(within(menu).getByRole('link', { name: 'The room' }).getAttribute('href')).toBe('/?ref=FRIEND1&utm_source=instagram#the-room');
    expect(screen.getAllByRole('link', { name: 'Member app' })[0]?.getAttribute('href')).toBe('https://player.invalid/?ref=FRIEND1&utm_source=instagram');
  });

  it('has grandpokerarena.com’s menu, top bar, footer columns and cookie banner, and no Academy in the menu', () => {
    render(<SitePage page={PAGE} playerUrl="https://player.invalid" attribution={null} />);
    const menu = screen.getByRole('navigation', { name: 'Site' });
    // On a phone the member app leads the links and the header's action ends them; from a tablet up they sit in the top
    // bar and beside the menu (UI polish audit A-25, W-03).
    expect(within(menu).getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Member app', 'The club', 'The room', 'Games', 'Membership', 'Leaderboard', "What’s on", 'Prizes and calendar', 'Journal', 'Visit and contact',
      'Request a seat',
    ]);
    const reserve = screen.getAllByRole('link', { name: 'Request a seat' })[0]?.getAttribute('href') ?? '';
    expect(reserve.startsWith('https://wa.me/918796580435?')).toBe(true);
    expect(new URL(reserve).searchParams.get('text')).toBe('Hi RIVR, I would like a seat tonight.');
    // The contacts are their marks, named for a screen reader; the number shows beside the phone.
    expect(within(screen.getByRole('list', { name: 'Contact' })).getAllByRole('link').map((link) => link.getAttribute('aria-label') ?? link.textContent)).toEqual([
      '+91 87965 80435', 'WhatsApp', 'Instagram', 'YouTube', 'info@rivrpoker.com',
    ]);
    expect(within(screen.getByRole('list', { name: 'Contact' })).getByRole('link', { name: 'WhatsApp' }).getAttribute('href')).toBe('https://wa.me/918796580435');
    // The top bar's, the header links' on a phone (A-25), and the footer's.
    expect(screen.getAllByRole('link', { name: 'Member app' }).map((link) => link.getAttribute('href'))).toEqual(['https://player.invalid/', 'https://player.invalid/', 'https://player.invalid/']);
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getAllByRole('navigation').map((column) => column.getAttribute('aria-label'))).toEqual(['The club', 'Play', 'Policies', 'Helplines']);
    expect(within(footer).getByRole('link', { name: 'Legal standing' }).getAttribute('href')).toBe('/about#legal-and-compliance');
    expect(within(footer).getByRole('link', { name: 'Tele-MANAS 14416 (24 hours)' }).getAttribute('href')).toBe('tel:14416');
    expect(document.querySelector('[data-cookie-banner]')).not.toBeNull();
  });

  it('gives a map band the club’s number and WhatsApp, as its content has neither (8 Nov audit, F-197)', () => {
    const map = { kind: 'map' as const, content: { address: 'Glaza, Gurugram', directionsUrl: 'https://www.google.com/maps/search/?api=1&query=Glaza' } };
    render(<SitePage page={{ ...PAGE, blocks: [map] }} playerUrl="https://player.invalid" attribution={null} />);
    const main = within(screen.getByRole('main'));
    expect(main.getByRole('link', { name: 'Call +91 87965 80435' }).getAttribute('href')).toBe('tel:+918796580435');
    expect(main.getByRole('link', { name: 'WhatsApp' }).getAttribute('href')).toBe('https://wa.me/918796580435');
  });

  it('dates the copyright with this year in India (8 Nov audit, F-192)', () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2027-12-31T19:00:00Z') });
    render(<SitePage page={PAGE} playerUrl="https://player.invalid" attribution={null} />);
    expect(screen.getByText('Copyright 2028 RIVR Poker Club')).toBeDefined();
    vi.useRealTimers();
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
      games: [{ name: 'NLH 50/100', smallBlind: 5000n, bigBlind: 10000n, buyInMin: 500000n, buyInMax: 500000n, straddle: null }],
      tournaments: [{ name: 'RIVR Sunday', startsAt: new Date('2026-11-15T10:30:00Z'), buyIn: 1000000n, guarantee: 50000000n }],
    };
    const { container } = render(<SitePage page={live} playerUrl="https://player.invalid/" attribution={null} />);
    expect(screen.getByText('Buy-in ₹5,000')).toBeDefined();
    expect(screen.queryByText(/running|waiting/)).toBeNull();
    // The header's Request a seat, the phone menu's, and the games block's.
    expect(screen.getAllByRole('link', { name: 'Request a seat' }).map((reserve) => reserve.getAttribute('href')?.startsWith('https://wa.me/'))).toEqual([true, true, true]);
    expect(container.querySelector('#games')).not.toBeNull();
    expect(screen.getByText('Sunday 15 Nov 2026, 16:00')).toBeDefined();
    expect(screen.getByRole('table', { name: 'The month at a glance' })).toBeDefined();
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
      promotions: [{ title: 'Referral', detail: '₹1,000 to each side', runs: 'Every day', rules: [], questions: [], isWelcome: false }],
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

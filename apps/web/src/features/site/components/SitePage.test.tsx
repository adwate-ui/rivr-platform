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
  tournaments: [],
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

  it('draws the live blocks from the rows the page loaded', () => {
    const live = {
      ...PAGE,
      blocks: [{ kind: 'games' as const, content: { heading: 'Games and stakes' } }, { kind: 'calendar' as const, content: {} }],
      games: [{ name: 'NLH 50/100', smallBlind: 5000n, bigBlind: 10000n, buyInMin: 500000n, buyInMax: 500000n, straddle: null, tablesOpen: 1 }],
      tournaments: [{ name: 'RIVR Sunday', startsAt: new Date('2026-11-15T10:30:00Z'), buyIn: 1000000n, guarantee: 50000000n }],
    };
    render(<SitePage page={live} playerUrl="https://player.invalid/" attribution={null} />);
    expect(screen.getByText('1 table running')).toBeDefined();
    expect(screen.getByText('Sunday 15 Nov 2026, 16:00')).toBeDefined();
  });
});

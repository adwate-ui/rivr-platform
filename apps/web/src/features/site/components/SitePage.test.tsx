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
});

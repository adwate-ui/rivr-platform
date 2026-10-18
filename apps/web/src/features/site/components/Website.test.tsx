import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { SiteView } from '../loadPage.ts';
import { Website } from './Website.tsx';

afterEach(cleanup);

/** A request with no page to show, from a visitor who arrived by a friend's link. */
function missing(status: 404 | 503): SiteView {
  return { status, title: '', description: null, page: null, attribution: { referral: 'FRIEND1' }, playerUrl: 'https://player.invalid' };
}

describe('the website without a page to show', () => {
  it('says the page does not exist, and the way home keeps the friend\'s code', () => {
    render(<Website view={missing(404)} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'RIVR Poker Club' }).getAttribute('href')).toBe('/?ref=FRIEND1');
  });

  it('says so when the content cannot be read, and the way home keeps the code', () => {
    render(<Website view={missing(503)} />);
    expect(screen.getByRole('heading', { level: 1, name: 'The website is not available' })).toBeDefined();
    expect(screen.getByText('Try again in a few minutes.')).toBeDefined();
    expect(screen.getByRole('link', { name: 'RIVR Poker Club' }).getAttribute('href')).toBe('/?ref=FRIEND1');
  });
});

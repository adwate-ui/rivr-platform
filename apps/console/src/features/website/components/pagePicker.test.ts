import type { EditorPage } from '@rivr/db/siteEditor';
import { describe, expect, it } from 'vitest';
import { pageGroups, pageLabel } from './pagePicker.ts';

const page = (slug: string, title: string): EditorPage => ({ pageId: `id-${slug}`, slug, title, pending: null });

/** The pages the seed gives the club, by address, as the editor reads them. */
const PAGES = [
  page('about', 'About'), page('home', 'RIVR Poker Club'), page('house-rules', 'House rules'), page('journal', 'Journal'),
  page('journal-bankroll', 'Bankroll basics'), page('links', 'RIVR Poker Club'), page('privacy', 'Privacy'), page('questions', 'Questions'),
  page('responsible-play', 'Responsible play'), page('terms', 'Terms of use'),
];

describe('the website’s page picker', () => {
  it('names the home page and the link-in-bio page apart, which share the club’s name as their title', () => {
    expect(pageLabel(page('home', 'RIVR Poker Club'))).toBe('Home');
    expect(pageLabel(page('links', 'RIVR Poker Club'))).toBe('Link in bio');
    expect(pageLabel(page('about', 'About'))).toBe('About');
  });

  it('groups the pages into Club, Guides and Legal, each by name, with no name twice', () => {
    const groups = pageGroups(PAGES, '');
    expect(groups.map((group) => group.label)).toEqual(['Club', 'Guides', 'Legal']);
    expect(groups[0]?.items.map((item) => item.title)).toEqual(['About', 'Home', 'House rules', 'Link in bio']);
    expect(groups[1]?.items.map((item) => item.title)).toEqual(['Bankroll basics', 'Journal', 'Questions']);
    expect(groups[2]?.items.map((item) => item.title)).toEqual(['Privacy', 'Responsible play', 'Terms of use']);
    const titles = groups.flatMap((group) => group.items.map((item) => item.title));
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('keeps the pages whose name or address holds what is typed, case aside', () => {
    expect(pageGroups(PAGES, 'RULES').flatMap((group) => group.items.map((item) => item.title))).toEqual(['House rules']);
    expect(pageGroups(PAGES, 'bankroll').map((group) => group.label)).toEqual(['Guides']);
    expect(pageGroups(PAGES, 'nothing like it')).toEqual([]);
  });

  it('marks a page with a draft or a scheduled publish (F-029)', () => {
    const [club] = pageGroups([
      { pageId: 'a', slug: 'about', title: 'About', pending: 'draft' },
      { pageId: 'b', slug: 'careers', title: 'Careers', pending: 'scheduled' },
      { pageId: 'c', slug: 'contact', title: 'Contact', pending: null },
    ], '');
    expect(club?.items.map((item) => item.detail)).toEqual(['Draft', 'Scheduled', undefined]);
  });
});

import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { fetchSitePage } from './site.ts';

/** A client whose public views answer with `pages` and `blocks`; the calls are recorded. */
function siteClient(pages: unknown[], blocks: unknown[]) {
  const urls: string[] = [];
  const fetch: typeof globalThis.fetch = async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    urls.push(url);
    return Response.json(url.includes('/public_site_block') ? blocks : pages);
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', { global: { fetch }, auth: { persistSession: false } });
  return { client, urls };
}

const PAGES = [
  { slug: 'home', title: 'RIVR Poker Club', description: 'A members\' poker club.', nav_position: null },
  { slug: 'faq', title: 'FAQ', description: null, nav_position: 2 },
  { slug: 'academy', title: 'RIVR Academy', description: null, nav_position: 1 },
];

describe('fetchSitePage', () => {
  it('gives a page\'s blocks in order and the website\'s navigation, leaving out a block it cannot read', async () => {
    const { client, urls } = siteClient(PAGES, [
      { kind: 'hero', content: { heading: 'RIVR Poker Club', action: { label: 'Join RIVR', to: 'sign-up' } } },
      { kind: 'video', content: { url: 'x' } },
      { kind: 'text', content: { body: 'Cash games every night.' } },
    ]);
    expect(await fetchSitePage(client, 'gurugram', 'home')).toEqual({
      slug: 'home', title: 'RIVR Poker Club', description: 'A members\' poker club.',
      blocks: [
        { kind: 'hero', content: { heading: 'RIVR Poker Club', action: { label: 'Join RIVR', to: 'sign-up' } } },
        { kind: 'text', content: { body: 'Cash games every night.' } },
      ],
      navigation: [{ slug: 'academy', title: 'RIVR Academy' }, { slug: 'faq', title: 'FAQ' }],
    });
    expect(urls.every((url) => url.includes('venue_slug=eq.gurugram'))).toBe(true);
  });

  it('is null for a page the public views do not have', async () => {
    const { client } = siteClient(PAGES, []);
    expect(await fetchSitePage(client, 'gurugram', 'careers')).toBeNull();
  });
});

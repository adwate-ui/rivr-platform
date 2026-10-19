import { err, ok } from '@rivr/contracts/result';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { fetchSitePage } from './site.ts';

/** A client whose public views answer with `pages`, `blocks` and the live views' rows; the calls are recorded. */
function siteClient(pages: unknown[], blocks: unknown[], live: Record<string, { status?: number; body: unknown }> = {}) {
  const urls: string[] = [];
  const fetch: typeof globalThis.fetch = async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    urls.push(url);
    const view = Object.keys(live).find((name) => url.includes(`/${name}`));
    if (view) return Response.json(live[view]?.body, { status: live[view]?.status ?? 200 });
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
    expect(await fetchSitePage(client, 'home')).toEqual(ok({
      slug: 'home', title: 'RIVR Poker Club', description: 'A members\' poker club.',
      blocks: [
        { kind: 'hero', content: { heading: 'RIVR Poker Club', action: { label: 'Join RIVR', to: 'sign-up' } } },
        { kind: 'text', content: { body: 'Cash games every night.' } },
      ],
      navigation: [{ slug: 'academy', title: 'RIVR Academy' }, { slug: 'faq', title: 'FAQ' }],
      games: [],
      tournaments: [],
    }));
    expect(urls.find((url) => url.includes('/public_site_block'))).toContain('page_slug=eq.home');
    // A page without live blocks reads no live view.
    expect(urls.filter((url) => ['/public_table_status', '/public_waitlist_length', '/public_tournament_calendar'].some((view) => url.includes(view)))).toEqual([]);
  });

  const LIVE_BLOCKS = [{ kind: 'games', content: { heading: 'Games and stakes' } }, { kind: 'calendar', content: {} }];
  const TABLES = [
    { table_type_code: 'nlh_50_100', table_type_name: 'NLH 50/100', is_open: true, small_blind_paise: 5000, big_blind_paise: 10000,
      buy_in_min_paise: 500000, buy_in_max_paise: 500000, straddle_paise: null },
  ];
  const CALENDAR = [{ name: 'RIVR Sunday', starts_at: '2026-11-15T10:30:00+00:00', buy_in_paise: 1000000, guarantee_paise: 50000000 }];

  it('reads the games and the calendar from the live views when the page has their blocks', async () => {
    const { client } = siteClient(PAGES, LIVE_BLOCKS, {
      public_table_status: { body: TABLES }, public_waitlist_length: { body: [{ table_type_code: 'nlh_50_100', waiting: 2 }] },
      public_tournament_calendar: { body: CALENDAR },
    });
    const page = await fetchSitePage(client, 'home');
    expect(page.ok && page.value?.games).toEqual([
      { name: 'NLH 50/100', smallBlind: 5000n, bigBlind: 10000n, buyInMin: 500000n, buyInMax: 500000n, straddle: null, tablesOpen: 1, waiting: 2 },
    ]);
    expect(page.ok && page.value?.tournaments).toEqual([
      { name: 'RIVR Sunday', startsAt: new Date('2026-11-15T10:30:00Z'), buyIn: 1000000n, guarantee: 50000000n },
    ]);
  });

  it('is unavailable when a live view the page needs cannot be read', async () => {
    const { client } = siteClient(PAGES, LIVE_BLOCKS, {
      public_table_status: { body: TABLES }, public_waitlist_length: { body: [] },
      public_tournament_calendar: { status: 500, body: { message: 'down' } },
    });
    expect(await fetchSitePage(client, 'home')).toEqual(err('unavailable'));
  });

  it('is null for a page the public views do not have', async () => {
    const { client } = siteClient(PAGES, []);
    expect(await fetchSitePage(client, 'careers')).toEqual(ok(null));
  });

  it('is unavailable when the database cannot be read, for the website to say so', async () => {
    const fetch: typeof globalThis.fetch = async () => Response.json({ message: 'down' }, { status: 500 });
    const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', { global: { fetch }, auth: { persistSession: false } });
    expect(await fetchSitePage(client, 'home')).toEqual(err('unavailable'));
  });
});

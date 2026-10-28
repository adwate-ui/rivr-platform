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
  { venue_slug: 'rivr-gurugram', slug: 'home', title: 'RIVR Poker Club', description: 'A members\' poker club.', nav_position: null },
  { venue_slug: 'rivr-gurugram', slug: 'faq', title: 'FAQ', description: null, nav_position: 2 },
  { venue_slug: 'rivr-gurugram', slug: 'academy', title: 'RIVR Academy', description: null, nav_position: 1 },
];

describe('fetchSitePage', () => {
  it('pauses the page during a venue freeze, with no table running', async () => {
    const { client } = siteClient(PAGES, [{ kind: 'games', content: {} }], {
      public_venue_status: { body: [{ venue_slug: 'rivr-gurugram', is_frozen: true }] },
      public_table_status: { body: [{ table_type_code: 'nlh_50_100', table_type_name: 'NLH 50/100', is_open: true, small_blind_paise: 5000,
        big_blind_paise: 10000, buy_in_min_paise: 500000, buy_in_max_paise: 500000, straddle_paise: null }] },
      public_waitlist_length: { body: [] },
    });
    const page = await fetchSitePage(client, 'home');
    expect(page.ok && page.value?.isPaused).toBe(true);
    expect(page.ok && page.value?.games.map((game) => [game.tablesOpen, game.openSeats])).toEqual([[0, 0]]);
  });

  it('stays open while another live venue is frozen, such as one being purged', async () => {
    const { client } = siteClient(PAGES, [], {
      public_venue_status: { body: [{ venue_slug: 'rivr-gurugram', is_frozen: false }, { venue_slug: 'e2e-purge-room', is_frozen: true }] },
    });
    const page = await fetchSitePage(client, 'home');
    expect(page.ok && page.value?.isPaused).toBe(false);
  });

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
      promotions: [],
      wallPosts: [],
      isPaused: false,
    }));
    expect(urls.find((url) => url.includes('/public_site_block'))).toContain('page_slug=eq.home');
    // A page without live blocks reads no live view.
    const live = ['/public_table_status', '/public_waitlist_length', '/public_tournament_calendar', '/public_promotion_cards'];
    expect(urls.filter((url) => live.some((view) => url.includes(view)))).toEqual([]);
  });

  const LIVE_BLOCKS = [{ kind: 'games', content: { heading: 'Games and stakes' } }, { kind: 'calendar', content: {} }];
  const TABLES = [
    { table_type_code: 'nlh_50_100', table_type_name: 'NLH 50/100', is_open: true, small_blind_paise: 5000, big_blind_paise: 10000,
      buy_in_min_paise: 500000, buy_in_max_paise: 500000, straddle_paise: null, seats: 9, seats_taken: 4 },
  ];
  const CALENDAR = [{ name: 'RIVR Sunday', starts_at: '2026-11-15T10:30:00+00:00', buy_in_paise: 1000000, guarantee_paise: 50000000 }];

  it('reads the games and the calendar from the live views when the page has their blocks', async () => {
    const { client } = siteClient(PAGES, LIVE_BLOCKS, {
      public_table_status: { body: TABLES }, public_waitlist_length: { body: [{ table_type_code: 'nlh_50_100', waiting: 2 }] },
      public_tournament_calendar: { body: CALENDAR },
    });
    const page = await fetchSitePage(client, 'home');
    expect(page.ok && page.value?.games).toEqual([
      { name: 'NLH 50/100', smallBlind: 5000n, bigBlind: 10000n, buyInMin: 500000n, buyInMax: 500000n, straddle: null, tablesOpen: 1, openSeats: 5, waiting: 2 },
    ]);
    expect(page.ok && page.value?.tournaments).toEqual([
      { name: 'RIVR Sunday', startsAt: new Date('2026-11-15T10:30:00Z'), buyIn: 1000000n, guarantee: 50000000n },
    ]);
  });

  it('reads the live promotions when the page has their block, leaving out a card with no title (decision 0166)', async () => {
    const { client, urls } = siteClient(PAGES, [{ kind: 'promotions', content: { heading: 'Running now' } }], {
      public_promotion_cards: { body: [{ title: 'Referral', detail: '₹1,000 to each side', runs: 'Every day' }, { title: null, detail: null, runs: null }] },
    });
    const page = await fetchSitePage(client, 'home');
    expect(page.ok && page.value?.promotions).toEqual([{ title: 'Referral', detail: '₹1,000 to each side', runs: 'Every day' }]);
    expect(urls.some((url) => url.includes('/public_table_status'))).toBe(false);
  });

  it('is unavailable when the promotions cannot be read', async () => {
    const { client } = siteClient(PAGES, [{ kind: 'promotions', content: {} }], { public_promotion_cards: { status: 500, body: { message: 'down' } } });
    expect(await fetchSitePage(client, 'home')).toEqual(err('unavailable'));
  });

  it('is unavailable when the waitlist counts cannot be read', async () => {
    const { client } = siteClient(PAGES, LIVE_BLOCKS, {
      public_table_status: { body: TABLES }, public_waitlist_length: { status: 500, body: { message: 'down' } },
      public_tournament_calendar: { body: CALENDAR },
    });
    expect(await fetchSitePage(client, 'home')).toEqual(err('unavailable'));
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

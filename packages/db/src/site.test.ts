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
  it('pauses the page during a venue freeze', async () => {
    const { client } = siteClient(PAGES, [], { public_venue_status: { body: [{ venue_slug: 'rivr-gurugram', is_frozen: true }] } });
    const page = await fetchSitePage(client, 'home');
    expect(page.ok && page.value?.isPaused).toBe(true);
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
      league: { month: null, season: null },
      rules: { pointsPerHour: [], rakebackBasisPoints: [], hotelNightHours: [], rewardsRakeShareBasisPoints: null, cabVisits: null,
        leaguePrizes: { month: null, season: null }, badBeat: null, highHands: null },
      jackpotPool: null,
      isPaused: false,
    }));
    expect(urls.find((url) => url.includes('/public_site_block'))).toContain('page_slug=eq.home');
    // A page without live blocks reads no live view.
    const live = ['/public_table_status', '/public_tournament_calendar', '/public_promotion_cards', '/public_league_table', '/public_club_rules'];
    expect(urls.filter((url) => live.some((view) => url.includes(view)))).toEqual([]);
  });

  const LIVE_BLOCKS = [{ kind: 'games', content: { heading: 'Games and stakes' } }, { kind: 'calendar', content: {} }];
  const TABLES = [
    { table_type_code: 'nlh_50_100', table_type_name: 'NLH 50/100', is_open: true, small_blind_paise: 5000, big_blind_paise: 10000,
      buy_in_min_paise: 500000, buy_in_max_paise: 500000, straddle_paise: null, seats: 9, seats_taken: 4 },
  ];
  const CALENDAR = [{ name: 'RIVR Sunday', starts_at: '2026-11-15T10:30:00+00:00', buy_in_paise: 1000000, guarantee_paise: 50000000 }];

  it('reads the games’ stakes and the calendar from the live views when the page has their blocks, and no waiting counts', async () => {
    const { client, urls } = siteClient(PAGES, LIVE_BLOCKS, { public_table_status: { body: TABLES }, public_tournament_calendar: { body: CALENDAR } });
    const page = await fetchSitePage(client, 'home');
    expect(page.ok && page.value?.games).toEqual([
      { name: 'NLH 50/100', smallBlind: 5000n, bigBlind: 10000n, buyInMin: 500000n, buyInMax: 500000n, straddle: null },
    ]);
    expect(urls.some((url) => url.includes('/public_waitlist_length'))).toBe(false);
    expect(page.ok && page.value?.tournaments).toEqual([
      { name: 'RIVR Sunday', startsAt: new Date('2026-11-15T10:30:00Z'), buyIn: 1000000n, guarantee: 50000000n },
    ]);
  });

  it('reads the live promotions when the page has their block, leaving out a card with no title (decision 0166)', async () => {
    const { client, urls } = siteClient(PAGES, [{ kind: 'promotions', content: { heading: 'Running now' } }], {
      public_promotion_cards: { body: [
        { title: 'Referral', detail: '₹1,000 to each side', runs: 'Every day', rules: ['New members only'], is_welcome: true,
          questions: [{ question: 'Do I claim it?', answer: 'No.' }, { question: 'No answer' }] },
        { title: null, detail: null, runs: null, rules: null, questions: null, is_welcome: null },
      ] },
    });
    const page = await fetchSitePage(client, 'home');
    expect(page.ok && page.value?.promotions).toEqual([{
      title: 'Referral', detail: '₹1,000 to each side', runs: 'Every day', rules: ['New members only'], isWelcome: true,
      questions: [{ question: 'Do I claim it?', answer: 'No.' }],
    }]);
    expect(urls.some((url) => url.includes('/public_table_status'))).toBe(false);
  });

  it('is unavailable when the promotions cannot be read', async () => {
    const { client } = siteClient(PAGES, [{ kind: 'promotions', content: {} }], { public_promotion_cards: { status: 500, body: { message: 'down' } } });
    expect(await fetchSitePage(client, 'home')).toEqual(err('unavailable'));
  });

  it('reads the League and the club’s rules when the page has their blocks', async () => {
    const { client } = siteClient(PAGES, [{ kind: 'league', content: { heading: 'The RIVR League' } }, { kind: 'rewards', content: {} }], {
      public_league_table: { body: [
        { standing: 'month', season_name: null, first_month: '2026-11-01', place: 1, display_name: 'Zoya K.', points: 120 },
        { standing: 'month', season_name: null, first_month: '2026-11-01', place: 2, display_name: null, points: 80 },
        { standing: 'season', season_name: 'Winter 2026', first_month: '2026-11-01', place: 1, display_name: 'Zoya K.', points: 120 },
      ] },
      public_club_rules: { body: [
        { key: 'points.rewards_rake_share', subject_name: null, subject_order: null, value: { basis_points: 500 } },
        { key: 'league.prizes', subject_name: null, subject_order: null, value: { month: 'A seat in the final' } },
        { key: 'points.per_hour', subject_name: 'NLH 50/100', subject_order: 10000, value: { points: 5 } },
        { key: 'rakeback.rate', subject_name: 'NLH 50/100', subject_order: 10000, value: { basis_points: 1000, expires_days: 7 } },
        { key: 'rakeback.rate', subject_name: 'NLH 100/200', subject_order: 20000, value: { basis_points: 0, expires_days: 7 } },
        { key: 'cab.minimum_visits', subject_name: null, subject_order: null, value: { visits: 4 } },
      ] },
    });
    const page = await fetchSitePage(client, 'home');
    expect(page.ok && page.value?.league).toEqual({
      month: { first: '2026-11-01', standings: [{ place: 1, name: 'Zoya K.', points: 120 }, { place: 2, name: null, points: 80 }] },
      season: { name: 'Winter 2026', standings: [{ place: 1, name: 'Zoya K.', points: 120 }] },
    });
    expect(page.ok && page.value?.rules).toEqual({
      pointsPerHour: [{ table: 'NLH 50/100', value: 5 }],
      // A rakeback of 0 gives none, so it is not shown.
      rakebackBasisPoints: [{ table: 'NLH 50/100', value: 1000 }],
      hotelNightHours: [],
      rewardsRakeShareBasisPoints: 500,
      cabVisits: 4,
      leaguePrizes: { month: 'A seat in the final', season: null },
      badBeat: null,
      highHands: null,
    });
  });

  it('is unavailable when the club’s rules cannot be read', async () => {
    const { client } = siteClient(PAGES, [{ kind: 'outstation', content: {} }], { public_club_rules: { status: 500, body: { message: 'down' } } });
    expect(await fetchSitePage(client, 'home')).toEqual(err('unavailable'));
  });

  it('is unavailable when a live view the page needs cannot be read', async () => {
    const { client } = siteClient(PAGES, LIVE_BLOCKS, {
      public_table_status: { body: TABLES }, public_tournament_calendar: { status: 500, body: { message: 'down' } },
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

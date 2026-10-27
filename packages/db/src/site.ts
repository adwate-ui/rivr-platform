import { err, ok, type Result } from '@rivr/contracts/result';
import { siteBlockSchema, type SiteBlock } from '@rivr/contracts/site';
import type { RivrClient } from './client.ts';
import { fetchSiteCalendar, fetchSiteGames, fetchSitePromotions, type SiteGame, type SitePromotion, type SiteTournament } from './siteLive.ts';

export type { SiteGame, SitePromotion, SiteTournament } from './siteLive.ts';

/** A page in the website's navigation. */
export interface SiteLink {
  readonly slug: string;
  readonly title: string;
}

/** A published page of a venue's website: its blocks in order, and the website's navigation. */
export interface SitePage {
  readonly slug: string;
  readonly title: string;
  readonly description: string | null;
  readonly blocks: readonly SiteBlock[];
  readonly navigation: readonly SiteLink[];
  /** The club's games, when the page has a games block; otherwise empty. */
  readonly games: readonly SiteGame[];
  /** The coming tournaments, when the page has a calendar block; otherwise empty. */
  readonly tournaments: readonly SiteTournament[];
  /** The live promotions, when the page has a promotions block; otherwise empty (decision 0166). */
  readonly promotions: readonly SitePromotion[];
  /** The club is paused by a venue freeze (#278): the page says so first, and no table is running. */
  readonly isPaused: boolean;
}

/** The live rows a page's blocks show, read only when one of its blocks needs them. */
async function fetchLive(client: RivrClient, blocks: readonly SiteBlock[]) {
  const needs = (kind: SiteBlock['kind']) => blocks.some((block) => block.kind === kind);
  const [games, tournaments, promotions] = await Promise.all([
    needs('games') ? fetchSiteGames(client) : ok([]),
    needs('calendar') ? fetchSiteCalendar(client) : ok([]),
    needs('promotions') ? fetchSitePromotions(client) : ok([]),
  ]);
  if (!games.ok || !tournaments.ok || !promotions.ok) return err('unavailable' as const);
  return ok({ games: games.value, tournaments: tournaments.value, promotions: promotions.value });
}

/**
 * A published page of the club's website, as the public views give it, or null when there is none:
 * a draft, or no such page. The views hold only the club's pages, the one venue that is not the
 * practice venue, as sign-up picks it (decision 0036). For the website's server, once per request.
 * A block the website cannot read is left out rather than break the page. During a venue freeze the page is paused (#278). `unavailable` when the
 * database cannot be read.
 */
export async function fetchSitePage(client: RivrClient, slug: string): Promise<Result<SitePage | null, 'unavailable'>> {
  const [pages, blocks, status] = await Promise.all([
    client.from('public_site_page').select('slug, title, description, nav_position'),
    client.from('public_site_block').select('kind, content').eq('page_slug', slug).order('position'),
    client.from('public_venue_status').select('is_frozen'),
  ]);
  if (pages.error || blocks.error || status.error) return err('unavailable');
  const isPaused = status.data.some((row) => row.is_frozen === true);
  const page = pages.data.find((row) => row.slug === slug);
  if (!page?.slug || !page.title) return ok(null);
  const navigation = pages.data
    .flatMap((row) => (row.slug && row.title && row.nav_position !== null ? [{ slug: row.slug, title: row.title, at: row.nav_position }] : []))
    .sort((a, b) => a.at - b.at)
    .map(({ slug: linked, title }) => ({ slug: linked, title }));
  const readable = blocks.data.flatMap((row) => {
    const block = siteBlockSchema.safeParse({ kind: row.kind, content: row.content });
    return block.success ? [block.data] : [];
  });
  const live = await fetchLive(client, readable);
  if (!live.ok) return live;
  const games = isPaused ? live.value.games.map((game) => ({ ...game, tablesOpen: 0, openSeats: 0 })) : live.value.games;
  return ok({ slug: page.slug, title: page.title, description: page.description, blocks: readable, navigation, ...live.value, games, isPaused });
}

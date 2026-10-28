import { err, ok, type Result } from '@rivr/contracts/result';
import { siteBlockSchema, type SiteBlock } from '@rivr/contracts/site';
import type { RivrClient } from './client.ts';
import {
  fetchSiteCalendar, fetchSiteGames, fetchSitePromotions, fetchSiteWall, type SiteGame, type SitePromotion, type SiteTournament, type SiteWallPost,
} from './siteLive.ts';

export type { SiteGame, SitePromotion, SiteTournament, SiteWallPost } from './siteLive.ts';

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
  /** The approved Instagram posts, when the page has a social wall block; otherwise empty (#157). */
  readonly wallPosts: readonly SiteWallPost[];
  /** The club is paused by a venue freeze (#278): the page says so first, and no table is running. */
  readonly isPaused: boolean;
}

/** The live rows a page's blocks show, read only when one of its blocks needs them. */
async function fetchLive(client: RivrClient, blocks: readonly SiteBlock[]) {
  const needs = (kind: SiteBlock['kind']) => blocks.some((block) => block.kind === kind);
  const [games, tournaments, promotions, wallPosts] = await Promise.all([
    needs('games') ? fetchSiteGames(client) : ok([]),
    needs('calendar') ? fetchSiteCalendar(client) : ok([]),
    needs('promotions') ? fetchSitePromotions(client) : ok([]),
    needs('social_wall') ? fetchSiteWall(client) : ok([]),
  ]);
  if (!games.ok || !tournaments.ok || !promotions.ok || !wallPosts.ok) return err('unavailable' as const);
  return ok({ games: games.value, tournaments: tournaments.value, promotions: promotions.value, wallPosts: wallPosts.value });
}

/**
 * A published page of the club's website, as the public views give it, or null when there is none:
 * a draft, or no such page. The views hold only the club's pages, the one venue that is not the
 * practice venue, as sign-up picks it (decision 0036). For the website's server, once per request.
 * A block the website cannot read is left out rather than break the page. During a venue freeze the page is paused (#278). `unavailable` when the
 * database cannot be read.
 */
export async function fetchSitePage(client: RivrClient, slug: string): Promise<Result<SitePage | null, 'unavailable'>> {
  const [frame, blocks] = await Promise.all([
    fetchFrame(client),
    client.from('public_site_block').select('kind, content').eq('page_slug', slug).order('position'),
  ]);
  if (!frame.ok || blocks.error) return err('unavailable');
  const page = frame.value.pages.find((row) => row.slug === slug);
  if (!page?.slug || !page.title) return ok(null);
  return pageWith(client, frame.value, { slug: page.slug, title: page.title, description: page.description }, blocks.data);
}

/**
 * A page's draft as the website will show it (#129, decision 0270): the website's navigation and live rows around the
 * draft's blocks, for a client made with the draft's preview token (`createRivrClient({ previewToken })`); null when the
 * token is no draft's. For the website's server.
 */
export async function fetchSitePreview(client: RivrClient): Promise<Result<SitePage | null, 'unavailable'>> {
  const [frame, draft] = await Promise.all([
    fetchFrame(client),
    client.from('public_site_preview').select('page_slug, title, description, kind, content').order('position'),
  ]);
  if (!frame.ok || draft.error) return err('unavailable');
  const first = draft.data[0];
  if (!first?.page_slug || !first.title) return ok(null);
  return pageWith(client, frame.value, { slug: first.page_slug, title: first.title, description: first.description }, draft.data);
}

/** The website around a page: its pages, for the navigation, and whether a venue freeze pauses it. */
async function fetchFrame(client: RivrClient) {
  const [pages, status] = await Promise.all([
    client.from('public_site_page').select('slug, title, description, nav_position'),
    client.from('public_venue_status').select('is_frozen'),
  ]);
  if (pages.error || status.error) return err('unavailable' as const);
  return ok({ pages: pages.data, isPaused: status.data.some((row) => row.is_frozen === true) });
}

type Frame = Extract<Awaited<ReturnType<typeof fetchFrame>>, { ok: true }>['value'];

/** A page from its blocks as read: those the website can show, in order, with the live rows they need. */
async function pageWith(client: RivrClient, frame: Frame, page: { slug: string; title: string; description: string | null },
  rows: readonly { kind: string | null; content: unknown }[]): Promise<Result<SitePage, 'unavailable'>> {
  const navigation = frame.pages
    .flatMap((row) => (row.slug && row.title && row.nav_position !== null ? [{ slug: row.slug, title: row.title, at: row.nav_position }] : []))
    .sort((a, b) => a.at - b.at)
    .map(({ slug: linked, title }) => ({ slug: linked, title }));
  const readable = rows.flatMap((row) => {
    const block = siteBlockSchema.safeParse({ kind: row.kind, content: row.content });
    return block.success ? [block.data] : [];
  });
  const live = await fetchLive(client, readable);
  if (!live.ok) return live;
  const games = frame.isPaused ? live.value.games.map((game) => ({ ...game, tablesOpen: 0, openSeats: 0 })) : live.value.games;
  return ok({ ...page, blocks: readable, navigation, ...live.value, games, isPaused: frame.isPaused });
}

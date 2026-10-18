import { siteBlockSchema, type SiteBlock } from '@rivr/contracts/site';
import type { RivrClient } from './client.ts';

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
}

/**
 * A published page of the club's website, as the public views give it, or null when there is none:
 * a draft, or no such page. The views hold only the club's pages, the one venue that is not the
 * practice venue, as sign-up picks it (decision 0036). For the website's server, once per request.
 * A block the website cannot read is left out rather than break the page.
 */
export async function fetchSitePage(client: RivrClient, slug: string): Promise<SitePage | null> {
  const [pages, blocks] = await Promise.all([
    client.from('public_site_page').select('slug, title, description, nav_position'),
    client.from('public_site_block').select('kind, content').eq('page_slug', slug).order('position'),
  ]);
  if (pages.error) throw pages.error;
  if (blocks.error) throw blocks.error;
  const page = pages.data.find((row) => row.slug === slug);
  if (!page?.slug || !page.title) return null;
  const navigation = pages.data
    .flatMap((row) => (row.slug && row.title && row.nav_position !== null ? [{ slug: row.slug, title: row.title, at: row.nav_position }] : []))
    .sort((a, b) => a.at - b.at)
    .map(({ slug: linked, title }) => ({ slug: linked, title }));
  const readable = blocks.data.flatMap((row) => {
    const block = siteBlockSchema.safeParse({ kind: row.kind, content: row.content });
    return block.success ? [block.data] : [];
  });
  return { slug: page.slug, title: page.title, description: page.description, blocks: readable, navigation };
}

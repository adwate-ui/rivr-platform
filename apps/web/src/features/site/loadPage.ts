import { attributionFrom } from '@rivr/contracts';
import { createRivrClient } from '@rivr/db';
import { fetchSitePage } from '@rivr/db/site';

// The club the website is for. One club for now; the public views carry each venue's slug.
const VENUE = 'gurugram';

/**
 * Everything a website page renders, read on the server for each request: the page from the public
 * views (null for a draft or no such page), the codes of the link the visitor arrived by, and where
 * the player app is.
 */
export async function loadPage(slug: string, url: URL) {
  const client = createRivrClient({ url: import.meta.env.PUBLIC_SUPABASE_URL, publishableKey: import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY });
  const page = await fetchSitePage(client, VENUE, slug);
  return { page, attribution: attributionFrom(url.search), playerUrl: import.meta.env.PUBLIC_PLAYER_URL };
}

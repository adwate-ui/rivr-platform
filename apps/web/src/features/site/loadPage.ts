import '../../messages.ts';
import { attributionFrom, type Attribution } from '@rivr/contracts';
import { t } from '@rivr/i18n';
import { createRivrClient } from '@rivr/db';
import { fetchSitePage, fetchSitePreview, type SitePage } from '@rivr/db/site';

/** What one request to the website renders: the page, or why there is none. */
export interface SiteView {
  /** 200 for a page, 404 for a draft or no such page, 503 when the content cannot be read. */
  readonly status: 200 | 404 | 503;
  readonly title: string;
  readonly description: string | null;
  readonly page: SitePage | null;
  /** The codes of the link the visitor arrived by, carried on every link, even from a missing page. */
  readonly attribution: Attribution | null;
  /** The player app's address. */
  readonly playerUrl: string;
}

/**
 * Reads a website page on the server for each request, from the public views. `slug` is null for an
 * address the website does not have at all.
 */
export async function loadPage(slug: string | null, url: URL): Promise<SiteView> {
  const shared = { attribution: attributionFrom(url.search), playerUrl: import.meta.env.PUBLIC_PLAYER_URL, page: null, description: null };
  if (slug === null) return { ...shared, status: 404, title: t('common.notFoundTitle') };
  const client = createRivrClient({ url: import.meta.env.PUBLIC_SUPABASE_URL, publishableKey: import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY });
  const result = await fetchSitePage(client, slug);
  if (!result.ok) return { ...shared, status: 503, title: t('web.unavailableTitle') };
  const page = result.value;
  if (!page) return { ...shared, status: 404, title: t('common.notFoundTitle') };
  return { ...shared, status: 200, page, title: page.title, description: page.description };
}

/**
 * A page's draft for the console's preview (#129, decision 0270), by its preview token: the draft's blocks in the
 * website's own frame. 404 for a token that is no draft's.
 */
export async function loadPreview(token: string | undefined, url: URL): Promise<SiteView> {
  const shared = { attribution: attributionFrom(url.search), playerUrl: import.meta.env.PUBLIC_PLAYER_URL, page: null, description: null };
  if (token === undefined || !/^[0-9a-f-]{36}$/.test(token)) return { ...shared, status: 404, title: t('common.notFoundTitle') };
  const client = createRivrClient({ url: import.meta.env.PUBLIC_SUPABASE_URL, publishableKey: import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY, previewToken: token });
  const result = await fetchSitePreview(client);
  if (!result.ok) return { ...shared, status: 503, title: t('web.unavailableTitle') };
  const page = result.value;
  if (!page) return { ...shared, status: 404, title: t('common.notFoundTitle') };
  return { ...shared, status: 200, page, title: page.title, description: page.description };
}

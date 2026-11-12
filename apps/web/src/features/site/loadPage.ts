import '../../messages.ts';
import { attributionFrom, type Attribution } from '@rivr/contracts';
import { t } from '@rivr/i18n';
import { createRivrClient, fetchClubContact, NO_CLUB_CONTACT, type ClubContact, type RivrClient } from '@rivr/db';
import { fetchSitePage, fetchSitePreview, type SitePage } from '@rivr/db/site';
import { documentTitle, localBusiness } from './documentHead.ts';

/** What one request to the website renders: the page, or why there is none. */
export interface SiteView {
  /** 200 for a page, 404 for a draft or no such page, 503 when the content cannot be read. */
  readonly status: 200 | 404 | 503;
  readonly title: string;
  readonly description: string | null;
  /** The club as data for search engines, ready for its script; null for a page that has none. */
  readonly structuredData: string | null;
  readonly page: SitePage | null;
  /** The codes of the link the visitor arrived by, carried on every link, even from a missing page. */
  readonly attribution: Attribution | null;
  /** The player app's address. */
  readonly playerUrl: string;
  /** The club's numbers for calls and WhatsApp, as set under Settings, Club (decision 0582); none when they cannot be read. */
  readonly contact: ClubContact;
}

/** The club's numbers; a page still shows without them, its links to call or WhatsApp left out. */
async function contactOf(client: RivrClient): Promise<ClubContact> {
  const read = await fetchClubContact(client);
  return read.ok ? read.value : NO_CLUB_CONTACT;
}

/**
 * Reads a website page on the server for each request, from the public views. `slug` is null for an
 * address the website does not have at all.
 */
export async function loadPage(slug: string | null, url: URL): Promise<SiteView> {
  const client = createRivrClient({ url: import.meta.env.PUBLIC_SUPABASE_URL, publishableKey: import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY });
  const [result, contact] = await Promise.all([slug === null ? Promise.resolve(null) : fetchSitePage(client, slug), contactOf(client)]);
  const shared = {
    attribution: attributionFrom(url.search), playerUrl: import.meta.env.PUBLIC_PLAYER_URL, page: null, description: null, structuredData: null, contact,
  };
  if (result === null) return { ...shared, status: 404, title: documentTitle(t('common.notFoundTitle')) };
  if (!result.ok) return { ...shared, status: 503, title: documentTitle(t('web.unavailableTitle')) };
  const page = result.value;
  if (!page) return { ...shared, status: 404, title: documentTitle(t('common.notFoundTitle')) };
  return {
    ...shared, status: 200, page, title: documentTitle(page.title), description: page.description, structuredData: localBusiness(page, url.origin, contact),
  };
}

/**
 * A page's draft for the console's preview (#129, decision 0270), by its preview token: the draft's blocks in the
 * website's own frame. 404 for a token that is no draft's.
 */
export async function loadPreview(token: string | undefined, url: URL): Promise<SiteView> {
  const shared = {
    attribution: attributionFrom(url.search), playerUrl: import.meta.env.PUBLIC_PLAYER_URL, page: null, description: null, structuredData: null, contact: NO_CLUB_CONTACT,
  };
  if (token === undefined || !/^[0-9a-f-]{36}$/.test(token)) return { ...shared, status: 404, title: t('common.notFoundTitle') };
  const client = createRivrClient({ url: import.meta.env.PUBLIC_SUPABASE_URL, publishableKey: import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY, previewToken: token });
  const [result, contact] = await Promise.all([fetchSitePreview(client), contactOf(client)]);
  if (!result.ok) return { ...shared, contact, status: 503, title: t('web.unavailableTitle') };
  const page = result.value;
  if (!page) return { ...shared, contact, status: 404, title: t('common.notFoundTitle') };
  return { ...shared, status: 200, page, title: page.title, description: page.description, contact };
}

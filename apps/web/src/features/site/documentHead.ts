import { CLUB_CONTACT } from '@rivr/contracts/club';
import type { ClubContact } from '@rivr/db';
import type { SitePage } from '@rivr/db/site';
import { t } from '@rivr/i18n';

/** A page's `<title>` and link preview: the page, the club and the city (8 Nov audit, F-194). A page named for the club does not say it twice. */
export function documentTitle(title: string): string {
  return title === t('ui.brand.label') ? t('web.clubTitle') : t('web.pageTitle', { page: title });
}

/** The pages that describe the club to search engines. */
const BUSINESS_PAGES: readonly string[] = ['home', 'visit'];

const EVERY_DAY = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** The hours as a map band writes them, `Open 14:00 to 08:00.`, for every day; nothing for hours written another way. */
function openingHours(hours: string | undefined) {
  const found = hours?.match(/(\d{2}:\d{2}) to (\d{2}:\d{2})/);
  return found ? { openingHoursSpecification: { '@type': 'OpeningHoursSpecification', dayOfWeek: EVERY_DAY, opens: found[1], closes: found[2] } } : {};
}

/**
 * The club as schema.org `LocalBusiness`, for the front page and Visit (F-194): the address and hours as the page's map
 * band has them, so the club's own edits carry through, and its number to call as set under Settings, Club (decision 0582). No
 * map coordinates, as the club has given none. Safe to put in a script: no `<` is left in it to close one.
 */
export function localBusiness(page: Pick<SitePage, 'slug' | 'blocks'>, origin: string, contact: ClubContact): string | null {
  const map = page.blocks.flatMap((block) => (block.kind === 'map' ? [block.content] : []))[0];
  if (map === undefined || !BUSINESS_PAGES.includes(page.slug)) return null;
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: t('ui.brand.label'),
    url: origin,
    telephone: map.phone ?? contact.phone ?? undefined,
    email: map.email ?? CLUB_CONTACT.email,
    address: { '@type': 'PostalAddress', streetAddress: map.address, addressLocality: 'Gurugram', addressRegion: 'Haryana', addressCountry: 'IN' },
    sameAs: [CLUB_CONTACT.instagram, CLUB_CONTACT.youtube],
    ...openingHours(map.hours),
  }).replace(/</g, '\\u003c');
}

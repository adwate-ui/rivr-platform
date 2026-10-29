import { attributionSearch, PLAYER_DESTINATIONS, type Attribution, type PlayerDestination } from '@rivr/contracts';

/** `?ref=…&utm_source=…` for the codes the visitor arrived with, or nothing. */
function query(attribution: Attribution | null): string {
  const search = attribution ? attributionSearch(attribution) : '';
  return search ? `?${search}` : '';
}

/**
 * A link into the player app that carries the codes of the link the visitor arrived by, so a sign-up
 * is credited to the friend, creator or campaign that brought them (#10, decision 0031).
 */
export function playerHref(playerUrl: string, to: PlayerDestination, attribution: Attribution | null): string {
  return `${new URL(PLAYER_DESTINATIONS[to], playerUrl).href}${query(attribution)}`;
}

/**
 * A link to another page of the website that keeps the codes, so they reach the player app from any page; with an
 * anchor, to one of its bands (#616).
 */
export function siteHref(slug: string, attribution: Attribution | null, anchor?: string): string {
  return `${slug === 'home' ? '/' : `/${slug}`}${query(attribution)}${anchor ? `#${anchor}` : ''}`;
}

/**
 * How the club is reached from every page (#616). Placeholders until the owner gives the club's number and channels:
 * the number is not a real one, so nobody is called by mistake.
 */
export const CLUB_CONTACT = {
  phone: '+910000000000',
  whatsapp: '910000000000',
  instagram: 'https://www.instagram.com/rivr.pokerclub/',
  youtube: 'https://www.youtube.com/@rivr.pokerclub',
  email: 'info@rivrpoker.com',
} as const;

/** A WhatsApp chat with the club, with `text` ready to send. */
export function whatsappHref(text?: string): string {
  return `https://wa.me/${CLUB_CONTACT.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

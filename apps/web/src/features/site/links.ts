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

/** A WhatsApp chat on the club's number (decision 0582), with `text` ready to send; wa.me takes the number without its plus. */
export function whatsappHref(whatsapp: string, text?: string): string {
  return `https://wa.me/${whatsapp.replace(/^\+/, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

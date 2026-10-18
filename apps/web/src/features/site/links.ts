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

/** A link to another page of the website that keeps the codes, so they reach the player app from any page. */
export function siteHref(slug: string, attribution: Attribution | null): string {
  return `${slug === 'home' ? '/' : `/${slug}`}${query(attribution)}`;
}

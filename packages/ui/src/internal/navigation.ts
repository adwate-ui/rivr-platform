import type { MouseEvent } from 'react';

/** Hands a link's destination to the app's router. Without one, the browser follows the href. */
export type Navigate = (href: string) => void;

/**
 * Click handler for a navigation link: a plain left click goes through the app's router,
 * while modified clicks (new tab, new window) keep the browser's behaviour.
 */
export function routeClick(event: MouseEvent<HTMLAnchorElement>, href: string, onNavigate: Navigate | undefined): void {
  const isModified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
  if (!onNavigate || isModified) return;
  event.preventDefault();
  onNavigate(href);
}

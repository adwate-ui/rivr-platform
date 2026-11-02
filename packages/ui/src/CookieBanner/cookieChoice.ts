/** What a visitor allowed beyond essential storage (#616; decision 0298): the website's map, and analytics. */
export interface CookieChoice {
  readonly maps: boolean;
  readonly analytics: boolean;
}

/** Where the choice is kept: in this browser only, never sent anywhere. */
const CHOICE_KEY = 'rivr.cookies';

/** RIVR's Google Tag Manager container (owner, 2 Nov): Google Analytics and the Meta pixel are set up inside it. */
export const TAG_MANAGER_CONTAINER = 'GTM-TQGH629H';

/** The choice this browser holds, or null while it holds none, or one made before analytics was asked about. */
export function storedCookieChoice(): CookieChoice | null {
  try {
    const choice: unknown = JSON.parse(localStorage.getItem(CHOICE_KEY) ?? 'null');
    if (typeof choice !== 'object' || choice === null) return null;
    const maps: unknown = Reflect.get(choice, 'maps');
    const analytics: unknown = Reflect.get(choice, 'analytics');
    return typeof maps === 'boolean' && typeof analytics === 'boolean' ? { maps, analytics } : null;
  } catch {
    return null;
  }
}

/** Keeps a choice; a browser that keeps nothing asks again next time. */
export function keepCookieChoice(choice: CookieChoice): void {
  try {
    localStorage.setItem(CHOICE_KEY, JSON.stringify({ maps: choice.maps, analytics: choice.analytics }));
  } catch {
    // Nothing kept: the page still loads what was allowed this time.
  }
}

/**
 * Loads Google Tag Manager, once a page, only after the visitor allowed analytics: Google's own snippet, with no
 * `noscript` fallback, as nothing may load without the choice a script reads.
 */
export function loadTagManager(container: string = TAG_MANAGER_CONTAINER): void {
  if (document.querySelector(`script[data-tag-manager="${container}"]`)) return;
  const existing: unknown = Reflect.get(window, 'dataLayer');
  const dataLayer: unknown[] = Array.isArray(existing) ? existing : [];
  Reflect.set(window, 'dataLayer', dataLayer);
  dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(container)}`;
  script.dataset.tagManager = container;
  document.head.appendChild(script);
}

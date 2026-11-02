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
 * `noscript` fallback, as nothing may load without the choice a script reads. Custom HTML tags and custom JavaScript
 * variables are blocked, so nothing published in the container can read a member's session in the app: Google
 * Analytics and the Meta pixel go in through their own templates. Never on a draft's preview page, whose address is its
 * key.
 */
export function loadTagManager(container: string = TAG_MANAGER_CONTAINER): void {
  if (location.pathname.startsWith('/preview/') || document.querySelector(`script[data-tag-manager="${container}"]`)) return;
  const existing: unknown = Reflect.get(window, 'dataLayer');
  const dataLayer: unknown[] = Array.isArray(existing) ? existing : [];
  Reflect.set(window, 'dataLayer', dataLayer);
  dataLayer.push({ 'gtm.blocklist': ['customScripts'] });
  dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(container)}`;
  script.dataset.tagManager = container;
  document.head.appendChild(script);
}

/** The cookies Google Analytics and the Meta pixel set on RIVR's own domains. */
const ANALYTICS_COOKIE = /^(_ga|_gid|_gat|_fbp|_fbc)/;

/**
 * Analytics turned off after it was on: its cookies go, on this host and the domain above it, and the page loads again,
 * so Tag Manager stops at once rather than at the next visit.
 */
export function stopAnalytics(): void {
  const host = location.hostname;
  const parent = host.split('.').slice(-2).join('.');
  for (const name of document.cookie.split(';').map((pair) => pair.split('=')[0]?.trim() ?? '')) {
    if (!ANALYTICS_COOKIE.test(name)) continue;
    for (const domain of ['', `; domain=${host}`, `; domain=.${parent}`]) document.cookie = `${name}=; max-age=0; path=/${domain}`;
  }
  location.reload();
}

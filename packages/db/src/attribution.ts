// The module itself, not the package index, which would put Zod on the player app's first screen.
import { attributionFrom, attributionSearch, type Attribution } from '@rivr/contracts/attribution';

// The first link with codes the player opened, kept in this browser until useSignUp carries it.
// Sign-up happens in the browser the link opened in; the app is installed after it (#16), so the
// codes never need to cross into the installed app.
const KEY = 'rivr.attribution';
const KEEP_FOR_MS = 30 * 24 * 60 * 60 * 1000;

/** The codes a new player arrived with, and when they first opened the link (ISO). */
export type SignUpAttribution = Attribution & { readonly firstSeenAt?: string };

/** What was stored: the link's query string and when it was first opened, or null. */
function readStored(): { search: string; firstSeenAt: string } | null {
  const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
  if (typeof stored !== 'object' || stored === null) return null;
  const search: unknown = Reflect.get(stored, 'search');
  const firstSeenAt: unknown = Reflect.get(stored, 'firstSeenAt');
  return typeof search === 'string' && typeof firstSeenAt === 'string' ? { search, firstSeenAt } : null;
}

/** The stored link's codes, or null when there are none or they are older than 30 days. */
export function storedAttribution(now = new Date()): SignUpAttribution | null {
  try {
    const stored = readStored();
    const age = now.getTime() - Date.parse(stored.firstSeenAt);
    // A time that does not read (NaN) counts as expired.
    if (stored === null || !(age <= KEEP_FOR_MS)) return null;
    const codes = attributionFrom(stored.search);
    return codes ? { ...codes, firstSeenAt: stored.firstSeenAt } : null;
  } catch {
    // Storage blocked (a private window): the codes are lost, and sign-up still works.
    return null;
  }
}

/**
 * Keeps the codes of the link the app opened with, unless an earlier link's are still kept (first
 * touch). The player app calls it once at start, with `window.location.search`.
 */
export function rememberAttribution(search: string, now = new Date()): void {
  const codes = attributionFrom(search);
  if (codes === null || storedAttribution(now) !== null) return;
  try {
    // Only the codes: anything else the link carried (a lead id, a number) is never kept.
    localStorage.setItem(KEY, JSON.stringify({ search: attributionSearch(codes), firstSeenAt: now.toISOString() }));
  } catch {
    // Storage blocked: nothing to keep.
  }
}

/** Forgets the codes once a sign-up has carried them. */
export function forgetAttribution(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: nothing was kept.
  }
}

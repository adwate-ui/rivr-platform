import type { BonusFileLineToSave } from '@rivr/db/bonusFile';

/**
 * The request id of each Bonus file sent with no answer yet (decision 0707). Any answer is the last word on its id (the
 * database answers a file that went as saved before it refuses anything), so an id is kept only until one comes. The same
 * file sent again goes under that id, after a refresh, the file chosen again, the panel or Members opened again or the page
 * reloaded, so a file that went through unseen is never saved twice. Kept for the browser tab in sessionStorage and in
 * memory, by venue and a fingerprint of the lines (never the lines: no reason or member is kept), the ten newest.
 */
const MOST_FILES = 10;
const memory = new Map<string, readonly (readonly [string, string])[]>();
const storageKey = (venueId: string) => `rivr.bonus-file.requests.${venueId}`;
const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A short fingerprint of a file's lines (cyrb53). Two files that share one only meet the database's refusal of a reused id. */
function fingerprintOf(lines: readonly BonusFileLineToSave[]): string {
  const text = JSON.stringify(lines);
  let a = 0xdeadbeef;
  let b = 0x41c6ce57;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    a = Math.imul(a ^ code, 2_654_435_761);
    b = Math.imul(b ^ code, 1_597_334_677);
  }
  a = Math.imul(a ^ (a >>> 16), 2_246_822_507) ^ Math.imul(b ^ (b >>> 13), 3_266_489_909);
  b = Math.imul(b ^ (b >>> 16), 2_246_822_507) ^ Math.imul(a ^ (a >>> 13), 3_266_489_909);
  return (4_294_967_296 * (2_097_151 & b) + (a >>> 0)).toString(36);
}

/** The ids sessionStorage holds for the venue, read past anything not a fingerprint and an id; none when it is not to be had. */
function storedIds(venueId: string): (readonly [string, string])[] {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(storageKey(venueId)) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((pair: unknown) => (Array.isArray(pair) && typeof pair[0] === 'string' && typeof pair[1] === 'string' && REQUEST_ID.test(pair[1])
      ? [[pair[0], pair[1]] as const] : []));
  } catch {
    return [];
  }
}

/**
 * The venue's kept ids, oldest first: those from before a reload, in sessionStorage, then those kept since, in memory, which
 * holds every one even where sessionStorage takes no more.
 */
function keptIds(venueId: string): (readonly [string, string])[] {
  const kept = memory.get(venueId) ?? [];
  const since = new Set(kept.map(([fingerprint]) => fingerprint));
  return [...storedIds(venueId).filter(([fingerprint]) => !since.has(fingerprint)), ...kept];
}

function keep(venueId: string, ids: readonly (readonly [string, string])[]) {
  memory.set(venueId, ids);
  try {
    sessionStorage.setItem(storageKey(venueId), JSON.stringify(ids));
  } catch {
    // Memory holds them while the page is open.
  }
}

/** Whether this file was sent before with no answer: an id is kept for it. */
export function hasRequestId(venueId: string, lines: readonly BonusFileLineToSave[]): boolean {
  const file = fingerprintOf(lines);
  return keptIds(venueId).some(([fingerprint]) => fingerprint === file);
}

/** The id this file goes under: the one kept for it, or a new one. */
export function requestIdFor(venueId: string, lines: readonly BonusFileLineToSave[]): string {
  const file = fingerprintOf(lines);
  return keptIds(venueId).find(([fingerprint]) => fingerprint === file)?.[1] ?? crypto.randomUUID();
}

/** Keeps this file's id until it is answered. */
export function keepRequestId(venueId: string, lines: readonly BonusFileLineToSave[], requestId: string) {
  const file = fingerprintOf(lines);
  const others = keptIds(venueId).filter(([fingerprint]) => fingerprint !== file);
  keep(venueId, [...others.slice(-(MOST_FILES - 1)), [file, requestId]]);
}

/** Forgets this file's id once it is answered: the next try of it is a new one. */
export function forgetRequestId(venueId: string, lines: readonly BonusFileLineToSave[]) {
  const file = fingerprintOf(lines);
  keep(venueId, keptIds(venueId).filter(([fingerprint]) => fingerprint !== file));
}

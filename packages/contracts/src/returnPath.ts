// A path in the same app: a slash, then segments of letters, digits and hyphens. No second slash at
// the start, scheme, backslash, query or fragment, so a link can never send someone to another site.
// Every repeated segment ends in its slash, so there is one way to match and the time stays linear
// (an optional slash would let a crafted link freeze the app).
const RETURN_PATH = /^\/(?:[A-Za-z0-9-]+\/)*[A-Za-z0-9-]*$/;

// Sign-in and sign-up are never where they return to: that would ask for the number again.
const SIGN_IN_PATH = /^\/sign-(?:in|up)(?:\/|$)/;

/** The screen a link pointed at, carried through sign-in as `?next=`. */
export interface ReturnSearch {
  readonly next?: string | undefined;
}

/** A path in the same app to return to after sign-in, or null for anything else (#233). */
export function returnPathFrom(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 200) return null;
  return RETURN_PATH.test(value) && !SIGN_IN_PATH.test(value) ? value : null;
}

/**
 * A sign-in or sign-up route's search: `next` only when it is a path in the app. Always sets the
 * key, so an outside address in the raw search is replaced, not kept beside the checked one.
 */
export function returnSearchFrom(search: Record<string, unknown>): ReturnSearch {
  return { next: returnPathFrom(search.next) ?? undefined };
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types.ts';

/** The typed Supabase client. Only @rivr/db creates or holds one. */
export type RivrClient = SupabaseClient<Database>;

export interface RivrClientOptions {
  readonly url: string;
  /** The project's publishable (anon) key. Never the service-role key. */
  readonly publishableKey: string;
}

/** Where the browser keeps the signed-in session. Sign-out removes it even when Auth cannot be reached. */
export const SESSION_STORAGE_KEY = 'rivr-session';

/** Where an enrolled cage or admin computer keeps its secret token (#384). It stays when staff sign out. */
export const COMPUTER_TOKEN_KEY = 'rivr-computer';

/** This computer's token, or null when it is not enrolled (or the browser blocks storage). */
export function computerToken(): string | null {
  try {
    return globalThis.localStorage.getItem(COMPUTER_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Database calls carry this computer's token, so the cage and admin work only from an enrolled computer
 * (#384, decision 0110). Only the database's API: Edge Functions name the headers they accept.
 */
export const fetchWithComputerToken: typeof fetch = (input, init) => {
  const token = computerToken();
  const url = input instanceof Request ? input.url : String(input);
  if (token === null || !url.includes('/rest/v1/')) return fetch(input, init);
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  headers.set('x-rivr-computer', token);
  return fetch(input, { ...init, headers });
};

/**
 * Creates the one client an app uses. A tablet or TV signs in as its own device login, which is how
 * the audit log knows the device; no header names one (docs/decisions/0022). A cage or admin computer
 * proves itself with its secret token, which only it holds (#384).
 * Sign-in is by phone code only, so a session carried in a link is never taken: it could sign a
 * shared cage computer in as someone else.
 */
export function createRivrClient({ url, publishableKey }: RivrClientOptions): RivrClient {
  return createClient<Database>(url, publishableKey, {
    auth: { storageKey: SESSION_STORAGE_KEY, detectSessionInUrl: false },
    global: { fetch: fetchWithComputerToken },
  });
}

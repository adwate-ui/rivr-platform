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

/**
 * Creates the one client an app uses. A tablet, cage computer or TV signs in as its own device
 * login, which is how the audit log knows the device; no header claims it (docs/decisions/0022).
 * Sign-in is by phone code only, so a session carried in a link is never taken: it could sign a
 * shared cage computer in as someone else.
 */
export function createRivrClient({ url, publishableKey }: RivrClientOptions): RivrClient {
  return createClient<Database>(url, publishableKey, { auth: { storageKey: SESSION_STORAGE_KEY, detectSessionInUrl: false } });
}

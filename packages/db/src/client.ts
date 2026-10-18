import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types.ts';

/** The typed Supabase client. Only @rivr/db creates or holds one. */
export type RivrClient = SupabaseClient<Database>;

export interface RivrClientOptions {
  readonly url: string;
  /** The project's publishable (anon) key. Never the service-role key. */
  readonly publishableKey: string;
}

/**
 * Creates the one client an app uses. A tablet, cage computer or TV signs in as its own device
 * login, which is how the audit log knows the device; no header claims it (docs/decisions/0022).
 */
export function createRivrClient({ url, publishableKey }: RivrClientOptions): RivrClient {
  return createClient<Database>(url, publishableKey);
}
